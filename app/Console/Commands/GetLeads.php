<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class GetLeads extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:get-leads {limit=10} {--mark-calling}';

    protected $description = 'Retrieve pending leads for the AI assistant to call.';

    public function handle()
    {
        $limit = $this->argument('limit');
        $markCalling = $this->option('mark-calling');

        $leads = \App\Models\Vendor::where('status', 'pending')
            ->limit($limit)
            ->get();

        if ($leads->isEmpty()) {
            $this->warn("No pending leads found.");
            return 0;
        }

        foreach ($leads as $lead) {
            $this->line("-----------------------------------");
            $this->info("NAME: " . ($lead->name ?? 'Unknown'));
            $this->info("PHONE: " . $lead->phone);
            if ($lead->whatsapp) {
                $this->info("WHATSAPP: " . $lead->whatsapp);
            }

            if ($lead->products) {
                $this->line("PRODUCTS:");
                foreach ($lead->products as $p) {
                    $this->line("- " . $p['title'] . " (" . $p['price'] . ")");
                }
            }

            if ($markCalling) {
                $lead->update(['status' => 'calling']);
            }
        }
        $this->line("-----------------------------------");

        return 0;
    }
}
