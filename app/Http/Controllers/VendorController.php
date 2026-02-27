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
            ]
        ];

        if (!array_key_exists($platform, $scraperConfig)) {
            return response()->json(["error" => "unsupported platform. Supported: jiji, konga"], 400);
        }

        $config = $scraperConfig[$platform];

        $url = str_starts_with($queryUrl, 'http') ? $queryUrl : $config['base_url'] . ltrim($queryUrl, '/');

        $process = new Process(['node', base_path($config['script']), $url, $pages]);
        $process->setTimeout(180); // 3 minutes timeout for scraping
        $process->start();
        $process->wait();

        $output = $process->getOutput();
        $vendors = json_decode($output, true);

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
