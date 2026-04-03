FROM php:8.2-cli

# 1. Install system dependencies + Chromium + Fonts + Xvfb (virtual display for headless:false)
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    gnupg \
    chromium \
    xvfb \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-freefont-ttf \
    nodejs \
    npm \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Configure Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Xvfb display - required for headless:false on Railway
ENV DISPLAY=:99

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Install Node dependencies (including puppeteer-extra + stealth plugin)
RUN npm install

# 3. Start Xvfb virtual display + Laravel server
EXPOSE 8080
CMD Xvfb :99 -screen 0 1280x800x24 -ac +extension GLX +render -noreset & \
    sleep 1 && \
    php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
