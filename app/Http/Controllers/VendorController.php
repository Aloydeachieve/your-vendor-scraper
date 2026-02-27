<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

class VendorController extends Controller
{
    public function scrape(Request $request)
    {
        $queryUrl = $request->query('url') ?? 'phones/lagos';
        if (!$queryUrl) {
            return response()->json(["error" => "missing url parameter"], 400);
        }

        $pages = $request->query('pages') ?? 1;

        $url = str_starts_with($queryUrl, 'http') ? $queryUrl : "https://jiji.ng/" . ltrim($queryUrl, '/');

        $process = new Process(['node', base_path('app/scraper.js'), $url, $pages]);
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
