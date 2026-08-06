<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vendor extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'whatsapp',
        'products',
        'status',
        'contacted_at',
        'outreach_channel',
        'last_reply',
    ];

    protected $casts = [
        'products'     => 'json',
        'contacted_at' => 'datetime',
    ];

    public function outreachLogs()
    {
        return $this->hasMany(OutreachLog::class);
    }

    /**
     * Scope: vendors not yet contacted.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }
}
