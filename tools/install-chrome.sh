#!/bin/bash

# Chrome/Chromium Installation Script for PDF Generation
# This script helps install Chrome dependencies for Puppeteer PDF generation

echo "🔍 Chrome/Chromium Installation Helper for PDF Generation"
echo "========================================================="

# Check current OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    echo "📋 Detected OS: $OS"
else
    echo "❌ Cannot detect operating system"
    exit 1
fi

# Function to install Chrome on Ubuntu/Debian
install_chrome_ubuntu() {
    echo "📦 Installing Google Chrome on Ubuntu/Debian..."

    # Update package list
    sudo apt-get update

    # Install dependencies
    sudo apt-get install -y wget gnupg

    # Add Google's signing key
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -

    # Add Chrome repository
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

    # Update package list again
    sudo apt-get update

    # Install Chrome
    sudo apt-get install -y google-chrome-stable

    echo "✅ Google Chrome installed successfully"
}

# Function to install Chromium on Ubuntu/Debian
install_chromium_ubuntu() {
    echo "📦 Installing Chromium on Ubuntu/Debian..."

    sudo apt-get update
    sudo apt-get install -y chromium-browser

    echo "✅ Chromium installed successfully"
}

# Function to install Chrome on CentOS/RHEL/Fedora
install_chrome_centos() {
    echo "📦 Installing Google Chrome on CentOS/RHEL/Fedora..."

    # Create Chrome repository file
    sudo tee /etc/yum.repos.d/google-chrome.repo <<EOF
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF

    # Install Chrome
    sudo yum install -y google-chrome-stable

    echo "✅ Google Chrome installed successfully"
}

# Function to install dependencies for Docker
install_docker_deps() {
    echo "🐳 Installing Chrome dependencies for Docker environment..."

    apt-get update && apt-get install -y \\
        ca-certificates \\
        fonts-liberation \\
        libappindicator3-1 \\
        libasound2 \\
        libatk-bridge2.0-0 \\
        libdrm2 \\
        libgtk-3-0 \\
        libnspr4 \\
        libnss3 \\
        lsb-release \\
        xdg-utils \\
        wget \\
        --no-install-recommends

    # Install Chrome
    wget -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    apt install -y /tmp/chrome.deb
    rm /tmp/chrome.deb

    echo "✅ Chrome installed for Docker environment"
}

# Main installation logic
case "$OS" in
    *"Ubuntu"*|*"Debian"*)
        echo "🐧 Ubuntu/Debian detected"

        read -p "Install Google Chrome (c) or Chromium (ch)? [c/ch]: " choice
        case $choice in
            c|C) install_chrome_ubuntu ;;
            ch|CH) install_chromium_ubuntu ;;
            *) echo "Invalid choice. Installing Chromium..." && install_chromium_ubuntu ;;
        esac
        ;;
    *"CentOS"*|*"Red Hat"*|*"Fedora"*)
        echo "🔴 CentOS/RHEL/Fedora detected"
        install_chrome_centos
        ;;
    *)
        echo "❌ Unsupported OS for automatic installation"
        echo "📖 Please install Google Chrome or Chromium manually:"
        echo "   - Ubuntu/Debian: sudo apt-get install google-chrome-stable"
        echo "   - CentOS/RHEL: sudo yum install google-chrome-stable"
        echo "   - Or use the Chromium alternative"
        exit 1
        ;;
esac

# Verify installation
echo ""
echo "🔍 Verifying installation..."

if command -v google-chrome >/dev/null 2>&1; then
    CHROME_PATH=$(which google-chrome)
    CHROME_VERSION=$(google-chrome --version)
    echo "✅ Google Chrome found: $CHROME_PATH"
    echo "📋 Version: $CHROME_VERSION"
elif command -v chromium-browser >/dev/null 2>&1; then
    CHROME_PATH=$(which chromium-browser)
    CHROME_VERSION=$(chromium-browser --version)
    echo "✅ Chromium found: $CHROME_PATH"
    echo "📋 Version: $CHROME_VERSION"
elif command -v chromium >/dev/null 2>&1; then
    CHROME_PATH=$(which chromium)
    CHROME_VERSION=$(chromium --version)
    echo "✅ Chromium found: $CHROME_PATH"
    echo "📋 Version: $CHROME_VERSION"
else
    echo "❌ Chrome/Chromium not found after installation"
    exit 1
fi

# Create environment variable suggestion
echo ""
echo "📝 Environment Configuration:"
echo "Add this to your .env file:"
echo "CHROMIUM_PATH=$CHROME_PATH"

# Test Puppeteer compatibility
echo ""
echo "🧪 Testing Puppeteer compatibility..."

node -e "
const puppeteer = require('puppeteer');

async function testPuppeteer() {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '$CHROME_PATH'
    });
    console.log('✅ Puppeteer can launch Chrome successfully');
    await browser.close();
    console.log('✅ PDF generation should work now!');
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
  }
}

testPuppeteer();
" 2>/dev/null || echo "⚠️  Cannot test Puppeteer (Node.js app not in this directory)"

echo ""
echo "🎉 Installation complete!"
echo "📋 Next steps:"
echo "   1. Restart your Node.js application"
echo "   2. Test PDF generation from the reports page"
echo "   3. If issues persist, check the application logs"
echo ""
