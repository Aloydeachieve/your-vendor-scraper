<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ScrapeJiji extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:scrape-jiji {url} {limit=50}';

    protected $description = 'Trigger Jiji scraper and save results to the vendors database lead bucket.';

    public function handle()
    {
        $url = $this->argument('url');
        $limit = $this->argument('limit');

        $this->info("Starting scraper for: $url (Limit: $limit)");

        $process = new \Symfony\Component\Process\Process(['node', base_path('app/scraper.js'), $url, $limit]);
        $process->setTimeout(1200); // 20 mins for large scrapes
        $process->run();

        if (!$process->isSuccessful()) {
            $this->error('Scraper failed: ' . $process->getErrorOutput());
            return 1;
        }

        $output = $process->getOutput();
        $jsonStart = strpos($output, '[');
        if ($jsonStart === false) {
            $this->error('No JSON output from scraper.');
            return 1;
        }

        $vendors = json_decode(substr($output, $jsonStart), true);
        if (!$vendors) {
            $this->error('Failed to decode JSON.');
            return 1;
        }

        $count = 0;
        foreach ($vendors as $v) {
            \App\Models\Vendor::updateOrCreate(
                ['phone' => $v['phone']],
                [
                    'name'     => $v['name'],
                    'whatsapp' => $v['whatsapp'],
                    'products' => $v['products'],
                    'status'   => 'pending',
                ]
            );
            $count++;
        }

        $this->info("Successfully processed $count vendors.");
        return 0;
    }
}
