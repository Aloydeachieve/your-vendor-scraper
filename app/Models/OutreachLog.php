<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OutreachLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'vendor_id',
        'channel',
        'message_sent',
        'status',
        'phone',
        'error_message',
        'sent_at',
        'replied_at',
    ];

    protected $casts = [
        'sent_at'    => 'datetime',
        'replied_at' => 'datetime',
    ];

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }
}
