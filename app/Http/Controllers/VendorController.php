<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

class VendorController extends Controller {
    public function scrape(Request $request) {
        $query = $request->query || 'phones/lagos';
        $pages = $request->pages ?? 1;
        
        $process = new Process(['node', app_path('scraper.js'), "https://jiji.ng/{$query}", $pages]);
        $process->start();
        $process->wait();
        
        $vendors = json_decode($process->getOutput(), true) ?: [];
        
        return response()->json([
            'count' => count($vendors),
            'data' => $vendors
        ]);
    }
}
