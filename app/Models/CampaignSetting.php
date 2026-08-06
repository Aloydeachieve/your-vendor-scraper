<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CampaignSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'message_template',
        'is_active',
        'messages_per_hour',
        'platforms',
        'search_urls',
        'kudicall_link',
    ];

    protected $casts = [
        'is_active'   => 'boolean',
        'platforms'   => 'array',
        'search_urls' => 'array',
    ];

    /**
     * Get the single active campaign (or create a default one).
     */
    public static function getActive(): self
    {
        return self::firstOrCreate(
            ['id' => 1],
            [
                'name'              => 'Kudicall Launch Campaign',
                'is_active'         => false,
                'messages_per_hour' => 20,
                'kudicall_link'     => 'https://kudicall.com',
                'platforms'         => ['jiji'],
                'search_urls'       => [],
            ]
        );
    }
}
