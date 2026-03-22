#!/bin/bash
# Set max_chunk_size to 90MB for Cloudflare free tier (100MB limit)
php occ config:app:set files max_chunk_size --value 94371840
