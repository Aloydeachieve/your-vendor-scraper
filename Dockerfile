FROM php:8.2-cli

# 1. Install system dependencies + Chromium + Fonts
# (Fonts are crucial for scrapers to render text correctly)
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    gnupg \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    nodejs \
    npm \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Configure Puppeteer to use the installed Chromium
# This tells Puppeteer: "Don't download Chrome, use /usr/bin/chromium instead"
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Install Node dependencies (including puppeteer-extra from your previous step)
RUN npm install

# 3. Use Railway's dynamic PORT or default to 8080
EXPOSE 8080
CMD php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
