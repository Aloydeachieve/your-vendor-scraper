<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MarkCalled extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:mark-called {phone} {status=called}';

    protected $description = 'Update a vendor lead status (e.g., called, converted, failed).';

    public function handle()
    {
        $phone = $this->argument('phone');
        $status = $this->argument('status');

        $vendor = \App\Models\Vendor::where('phone', $phone)->first();

        if (!$vendor) {
            $this->error("Vendor with phone $phone not found.");
            return 1;
        }

        $vendor->update(['status' => $status]);
        $this->info("Vendor $phone marked as $status.");

        return 0;
    }
}
