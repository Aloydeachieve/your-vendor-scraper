<?php

namespace App\Http\Controllers;

use App\Jobs\OutreachJob;
use App\Jobs\ScrapeThenOutreachJob;
use App\Models\CampaignSetting;
use App\Models\OutreachLog;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClawbotController extends Controller
{
    private function botUrl(): string
    {
        return 'http://127.0.0.1:' . env('CLAWBOT_PORT', 3001);
    }

    // ─── BOT HEALTH ──────────────────────────────────────────
    public function health(): JsonResponse
    {
        try {
            $response = Http::timeout(5)->get($this->botUrl() . '/health');
            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'status'  => 'offline',
                'error'   => 'Bot server is not running. Start it with: node app/clawbot/bot_server.js',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    // ─── START CAMPAIGN ──────────────────────────────────────
    public function start(Request $request): JsonResponse
    {
        $campaign = CampaignSetting::getActive();
        $campaign->update(['is_active' => true]);

        // Dispatch outreach for all currently pending vendors
        $pending = Vendor::pending()->get();
        $count   = 0;
        foreach ($pending as $vendor) {
            OutreachJob::dispatch($vendor->id)
                ->delay(now()->addSeconds($count * 180)); // stagger 3 min apart
            $count++;
        }

        // If search URLs configured, trigger a fresh scrape+outreach too
        $searchUrls = $campaign->search_urls ?? [];
        foreach ($searchUrls as $url) {
            $platform = $campaign->platforms[0] ?? 'jiji';
            ScrapeThenOutreachJob::dispatch($url, $platform, 10)
                ->delay(now()->addMinutes(2));
        }

        Log::info("[Clawbot] Campaign STARTED. {$count} pending vendors queued.");

        return response()->json([
            'message'         => 'Campaign started!',
            'vendors_queued'  => $count,
            'scrapes_queued'  => count($searchUrls),
        ]);
    }

    // ─── STOP CAMPAIGN ───────────────────────────────────────
    public function stop(): JsonResponse
    {
        $campaign = CampaignSetting::getActive();
        $campaign->update(['is_active' => false]);

        Log::info("[Clawbot] Campaign PAUSED.");

        return response()->json(['message' => 'Campaign paused. Running jobs will still complete.']);
    }

    // ─── STATUS / STATS ──────────────────────────────────────
    public function status(): JsonResponse
    {
        $campaign = CampaignSetting::getActive();

        $stats = [
            'campaign_active'    => $campaign->is_active,
            'messages_per_hour'  => $campaign->messages_per_hour,
            'total_vendors'      => Vendor::count(),
            'pending'            => Vendor::where('status', 'pending')->count(),
            'contacted'          => Vendor::where('status', 'contacted')->count(),
            'failed'             => Vendor::where('status', 'failed')->count(),
            'converted'          => Vendor::where('status', 'converted')->count(),
            'logs_today'         => OutreachLog::whereDate('created_at', today())->count(),
            'sent_today'         => OutreachLog::whereDate('created_at', today())->where('status', 'sent')->count(),
            'failed_today'       => OutreachLog::whereDate('created_at', today())->where('status', 'failed')->count(),
        ];

        // Bot server health
        try {
            $botHealth = Http::timeout(3)->get($this->botUrl() . '/health')->json();
            $stats['bot'] = $botHealth;
        } catch (\Exception $e) {
            $stats['bot'] = ['status' => 'offline'];
        }

        return response()->json($stats);
    }

    // ─── RECENT LOGS ─────────────────────────────────────────
    public function logs(Request $request): JsonResponse
    {
        $logs = OutreachLog::with('vendor:id,name,phone,whatsapp,status')
            ->latest()
            ->limit($request->query('limit', 50))
            ->get();

        return response()->json($logs);
    }

    // ─── CONFIGURE CAMPAIGN ──────────────────────────────────
    public function configure(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'              => 'nullable|string|max:255',
            'message_template'  => 'nullable|string',
            'messages_per_hour' => 'nullable|integer|min:1|max:50',
            'platforms'         => 'nullable|array',
            'search_urls'       => 'nullable|array',
            'kudicall_link'     => 'nullable|url',
        ]);

        $campaign = CampaignSetting::getActive();
        $campaign->update(array_filter($data, fn($v) => $v !== null));

        return response()->json([
            'message'  => 'Campaign updated!',
            'campaign' => $campaign->fresh(),
        ]);
    }

    // ─── MANUAL SEND (TEST) ──────────────────────────────────
    public function testSend(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone'   => 'required|string',
            'name'    => 'nullable|string',
            'product' => 'nullable|string',
        ]);

        try {
            $response = Http::timeout(120)->post($this->botUrl() . '/send', [
                'phone'   => $data['phone'],
                'name'    => $data['name'] ?? 'there',
                'product' => $data['product'] ?? null,
                'job_id'  => 'test-' . time(),
            ]);
            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ─── DISPATCH PENDING ─────────────────────────────────────
    // Re-queues any vendors stuck in "pending" state
    public function dispatchPending(): JsonResponse
    {
        $pending = Vendor::pending()->get();
        $count   = 0;
        foreach ($pending as $vendor) {
            OutreachJob::dispatch($vendor->id)
                ->delay(now()->addSeconds($count * 180));
            $count++;
        }
        return response()->json(['message' => "{$count} pending vendors dispatched to queue."]);
    }
}
