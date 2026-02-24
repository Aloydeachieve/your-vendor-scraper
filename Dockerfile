FROM php:8.2-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    chromium \
    chromium-driver \
    nodejs \
    npm \
    && apt-get clean

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy project
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Install Node dependencies
RUN npm install puppeteer

# Install Chrome for Puppeteer
RUN npx puppeteer browsers install chrome

EXPOSE 8080

CMD php artisan serve --host=0.0.0.0 --port=8080