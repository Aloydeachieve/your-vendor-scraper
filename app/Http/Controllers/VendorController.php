<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

class VendorController extends Controller
{
    public function scrape(Request $request)
    {
        $query = $request->query('url') ?? 'phones/lagos';
        $pages = $request->query('pages') ?? 1;

        $url = str_starts_with($query, 'http') ? $query : "https://jiji.ng/" . ltrim($query, '/');

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
