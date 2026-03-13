<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

class VendorController extends Controller
{
    public function scrape(Request $request)
    {
        $queryUrl = $request->query('url');
        if (!$queryUrl) {
            return response()->json(["error" => "missing url parameter"], 400);
        }

        $pages = $request->query('pages') ?? 1;
        $platform = $request->query('platform') ?? 'jiji'; // Defaults to Jiji

        // Map platforms to scripts and base URLs
        $scraperConfig = [
            'jiji' => [
                'script' => 'app/scraper.js',
                'base_url' => 'https://jiji.ng/'
            ],
            'konga' => [
                'script' => 'app/konga_scraper.js',
                'base_url' => 'https://www.konga.com/category/'
            ],
            'jumia' => [
                'script' => 'app/jumia_scraper.js',
                'base_url' => 'https://www.jumia.com.ng/'
            ],
            'ebay' => [
                'script' => 'app/ebay_scraper.js',
                'base_url' => 'https://www.ebay.com/sch/i.html?_nkw='
            ],
            'amazon' => [
                'script' => 'app/amazon_scraper.js',
                'base_url' => 'https://www.amazon.com/s?k='
            ],
            'olxGumtree' => [
                'script' => 'app/olxGumtree_scraper.js',
                'base_url' => 'https://www.olx.co.za/property-for-sale'
            ],
        ];

        if (!array_key_exists($platform, $scraperConfig)) {
            return response()->json(["error" => "unsupported platform. Supported: jiji, konga, jumia, ebay, amazon, olxGumtree"], 400);
        }

        $config = $scraperConfig[$platform];

        $url = str_starts_with($queryUrl, 'http') ? $queryUrl : $config['base_url'] . ltrim($queryUrl, '/');

        $process = new Process(['node', base_path($config['script']), $url, $pages]);
        $process->setTimeout(180); // 3 minutes timeout for scraping
        // Run the process
        $process->run();

        if (!$process->isSuccessful()) {
            return response()->json([
                'error' => 'Scraper crashed',
                'details' => $process->getErrorOutput()
            ], 500);
        }

        $output = $process->getOutput();
        // Clean any potential Node warnings from the output string
        $cleanOutput = substr($output, strpos($output, '['));
        $vendors = json_decode($cleanOutput, true);

        if ($vendors === null) {
            return response()->json([
                'error' => 'Scraper failed to return valid JSON',
                'details' => $process->getErrorOutput(),
                'count' => 0,
                'data' => []
            ], 500);
        }

        return response()->json([
            'count' => count($vendors),
            'data' => $vendors
        ]);
    }
}
