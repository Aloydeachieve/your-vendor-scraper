<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\VendorController;
use App\Http\Controllers\ClawbotController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::get('/scrape', [VendorController::class, 'scrape']);

// ─── Clawbot Routes ───────────────────────────────────────────
Route::prefix('clawbot')->group(function () {
    Route::get('/health',           [ClawbotController::class, 'health']);
    Route::get('/status',           [ClawbotController::class, 'status']);
    Route::get('/logs',             [ClawbotController::class, 'logs']);
    Route::post('/start',           [ClawbotController::class, 'start']);
    Route::post('/stop',            [ClawbotController::class, 'stop']);
    Route::post('/configure',       [ClawbotController::class, 'configure']);
    Route::post('/test-send',       [ClawbotController::class, 'testSend']);
    Route::post('/dispatch-pending',[ClawbotController::class, 'dispatchPending']);
});
