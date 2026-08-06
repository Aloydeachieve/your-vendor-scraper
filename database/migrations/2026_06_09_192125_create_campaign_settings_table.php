<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('campaign_settings', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('Kudicall Launch Campaign');
            $table->text('message_template')->nullable(); // custom override
            $table->boolean('is_active')->default(false);
            $table->integer('messages_per_hour')->default(20);
            $table->json('platforms')->nullable(); // e.g. ["jiji","konga"]
            $table->json('search_urls')->nullable(); // list of scrape URLs
            $table->string('kudicall_link')->default('https://kudicall.com');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaign_settings');
    }
};
