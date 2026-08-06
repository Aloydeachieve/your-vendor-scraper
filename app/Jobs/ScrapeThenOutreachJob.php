<?php

namespace App\Jobs;

use App\Models\Vendor;
use App\Models\CampaignSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class ScrapeThenOutreachJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes per scrape run
    public $tries   = 1;

    protected string $searchUrl;
    protected string $platform;
    protected int    $limit;

    public function __construct(string $searchUrl, string $platform = 'jiji', int $limit = 10)
    {
        $this->searchUrl = $searchUrl;
        $this->platform  = $platform;
        $this->limit     = $limit;
    }

    public function handle(): void
    {
        $campaign = CampaignSetting::getActive();

        if (!$campaign->is_active) {
            Log::info("[Clawbot] Campaign is paused. ScrapeThenOutreach skipped.");
            return;
        }

        Log::info("[Clawbot] Starting scrape: {$this->searchUrl} ({$this->platform}, limit={$this->limit})");

        // Map platform → scraper script
        $scraperMap = [
            'jiji'       => 'app/scraper.js',
            'konga'      => 'app/konga_scraper.js',
            'jumia'      => 'app/jumia_scraper.js',
            'ebay'       => 'app/ebay_scraper.js',
            'amazon'     => 'app/amazon_scraper.js',
            'olxGumtree' => 'app/olxGumtree_scraper.js',
        ];

        $script = $scraperMap[$this->platform] ?? 'app/scraper.js';

        $process = new Process(['node', base_path($script), $this->searchUrl, $this->limit]);
        $process->setTimeout(540);
        $process->setEnv([
            'JIJI_EMAIL'    => trim(env('JIJI_EMAIL', '')),
            'JIJI_PASSWORD' => env('JIJI_PASSWORD', ''),
            'JIJI_ACCOUNTS' => env('JIJI_ACCOUNTS', ''),
            'ROTATE_EVERY'  => env('ROTATE_EVERY', 50),
        ]);
        $process->run();

        if (!$process->isSuccessful()) {
            Log::error("[Clawbot] Scraper failed: " . $process->getErrorOutput());
            return;
        }

        $output     = $process->getOutput();
        $jsonStart  = strpos($output, '[');
        if ($jsonStart === false) {
            Log::warning("[Clawbot] Scraper returned no JSON.");
            return;
        }

        $vendors = json_decode(substr($output, $jsonStart), true);

        if (!is_array($vendors)) {
            Log::warning("[Clawbot] Scraper returned invalid JSON.");
            return;
        }

        $newCount = 0;
        foreach ($vendors as $v) {
            if (empty($v['phone'])) continue;

            $vendor = Vendor::updateOrCreate(
                ['phone' => $v['phone']],
                [
                    'name'     => $v['name']     ?? null,
                    'whatsapp' => $v['whatsapp'] ?? null,
                    'products' => $v['products'] ?? [],
                    'status'   => 'pending',
                ]
            );

            // Only dispatch outreach for newly created vendors
            if ($vendor->wasRecentlyCreated) {
                $newCount++;
                OutreachJob::dispatch($vendor->id)
                    ->delay(now()->addSeconds($newCount * 180)); // stagger by 3 min each
            }
        }

        Log::info("[Clawbot] Scrape done. {$newCount} new vendor(s) queued for outreach.");
    }
}
