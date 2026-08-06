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
        Schema::table('vendors', function (Blueprint $table) {
            $table->timestamp('contacted_at')->nullable()->after('status');
            $table->string('outreach_channel')->nullable()->after('contacted_at');
            $table->text('last_reply')->nullable()->after('outreach_channel');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn(['contacted_at', 'outreach_channel', 'last_reply']);
        });
    }
};
