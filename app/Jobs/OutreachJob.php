<?php

namespace App\Jobs;

use App\Models\Vendor;
use App\Models\OutreachLog;
use App\Models\CampaignSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OutreachJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 300, 900]; // retry after 1min, 5min, 15min

    protected int $vendorId;

    public function __construct(int $vendorId)
    {
        $this->vendorId = $vendorId;
    }

    public function handle(): void
    {
        $vendor = Vendor::find($this->vendorId);

        if (!$vendor) {
            Log::warning("[Clawbot] Vendor #{$this->vendorId} not found. Skipping.");
            return;
        }

        // Skip if already contacted
        if (in_array($vendor->status, ['contacted', 'converted'])) {
            Log::info("[Clawbot] Vendor #{$this->vendorId} ({$vendor->phone}) already contacted. Skipping.");
            return;
        }

        // Prefer WhatsApp number, fall back to phone
        $phone = $vendor->whatsapp ?? $vendor->phone;

        if (!$phone) {
            Log::warning("[Clawbot] Vendor #{$this->vendorId} has no phone. Skipping.");
            $vendor->update(['status' => 'failed']);
            return;
        }

        // Get vendor's first product for personalisation
        $products  = is_array($vendor->products) ? $vendor->products : [];
        $product   = $products[0]['title'] ?? null;
        $name      = $vendor->name;

        // Get campaign settings (custom template + link)
        $campaign       = CampaignSetting::getActive();
        $customTemplate = $campaign->message_template ?: null; // null = use built-in
        $kudicallLink   = $campaign->kudicall_link ?: env('KUDICALL_LINK', 'https://kudicall.com');

        $botPort = env('CLAWBOT_PORT', 3001);
        $botUrl  = "http://127.0.0.1:{$botPort}/send";

        Log::info("[Clawbot] Sending outreach to {$phone} (Vendor #{$this->vendorId})");

        try {
            $response = Http::timeout(120)->post($botUrl, [
                'phone'           => $phone,
                'name'            => $name,
                'product'         => $product,
                'job_id'          => $this->job?->getJobId() ?? 'queue',
                'custom_template' => $customTemplate,
                'kudicall_link'   => $kudicallLink,
            ]);

            $body = $response->json();

            if ($response->successful() && ($body['success'] ?? false)) {
                // SUCCESS
                $vendor->update([
                    'status'           => 'contacted',
                    'contacted_at'     => now(),
                    'outreach_channel' => 'whatsapp',
                ]);

                OutreachLog::create([
                    'vendor_id'    => $vendor->id,
                    'channel'      => 'whatsapp',
                    'message_sent' => $customTemplate ?? 'Built-in Kudicall pitch + Link',
                    'status'       => 'sent',
                    'phone'        => $phone,
                    'sent_at'      => now(),
                ]);

                Log::info("[Clawbot] ✅ Contacted vendor #{$this->vendorId} ({$phone})");

            } else {
                // BOT RETURNED AN ERROR
                $errorMsg = $body['error'] ?? 'Unknown bot error';
                Log::error("[Clawbot] ❌ Bot error for #{$this->vendorId}: {$errorMsg}");
                $this->logFailure($vendor, $phone, $errorMsg);
                $this->fail(new \Exception($errorMsg));
            }

        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();
            Log::error("[Clawbot] ❌ HTTP error for #{$this->vendorId}: {$errorMsg}");
            $this->logFailure($vendor, $phone, $errorMsg);
            throw $e; // triggers retry
        }
    }

    private function logFailure(Vendor $vendor, string $phone, string $error): void
    {
        OutreachLog::create([
            'vendor_id'     => $vendor->id,
            'channel'       => 'whatsapp',
            'status'        => 'failed',
            'phone'         => $phone,
            'error_message' => $error,
            'sent_at'       => now(),
        ]);

        $vendor->update(['status' => 'failed']);
    }
}
