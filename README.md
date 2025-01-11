# Message Broker Insights (MBI) Web Interface
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue?style=square)](https://opensource.org/licenses/Apache-2.0)
[![Tests Status](https://github.com/DeX-Group-LLC/message-broker-insights/actions/workflows/tests.yml/badge.svg?style=square)](https://github.com/DeX-Group-LLC/message-broker-insights/actions/workflows/tests.yml)
[![Coverage Status](https://coveralls.io/repos/github/DeX-Group-LLC/message-broker-insights/badge.svg?branch=main&style=square)](https://coveralls.io/github/DeX-Group-LLC/message-broker-insights?branch=main)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen?style=square)](https://nodejs.org)
[![NPM Version](https://img.shields.io/badge/npm%20package-deadbeef-green?style=square)](https://www.npmjs.com/package/message-broker-insights)
[![Dependencies](https://img.shields.io/librariesio/release/npm/message-broker-insights?style=square)](https://libraries.io/npm/message-broker-insights)
[![Install Size](https://packagephobia.com/badge?p=message-broker-insights?style=square)](https://packagephobia.com/result?p=message-broker-insights)

🌐 A modern Angular-based web interface for the Message Broker, providing real-time monitoring, log viewing, and system metrics visualization. Built with Angular Material for a clean, responsive user experience.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Building](#building)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)

## Features

- 🎨 Comprehensive Theme System:
  - 🌙 Light/Dark mode with system preference detection
  - 12 Material Design color palettes (Red, Green, Blue, Yellow, etc.)
  - Persistent theme preferences
  - Real-time theme switching
- 📊 System Metrics and Analytics:
  - Real-time performance metrics visualization
  - Historical metrics tracking and trends
- 📝 Live log streaming with filtering and search
- 📱 Responsive design with collapsible navigation
- 🔄 WebSocket-based real-time updates with comprehensive connection monitoring:
  - Visual connection status indicator (Connecting, Connected, Reconnecting, Disconnected)
  - Connection details (server URL, latency, last connected time)
  - Automatic reconnection with attempt tracking
  - Real-time connection event history
  - Manual reconnection option
- 🎨 Material Design with Angular Material components
- 🔍 Advanced filtering and sorting capabilities
- ⚡ Optimized performance with virtual scrolling
- 🔌 Service Management and Monitoring:
  - Real-time status and heartbeat monitoring
  - Service metrics and metadata visualization
  - Subscription tracking and management
  - Advanced filtering and service controls
  - Expandable detailed views

### Theme System
The application supports both light/dark modes and multiple color themes:

- **Mode Selection**: Choose between Light, Dark, or System mode
- **Color Palettes**: Available color themes:
  - Red
  - Green
  - Blue
  - Yellow
  - Cyan
  - Magenta
  - Orange
  - Chartreuse
  - Spring Green
  - Azure
  - Violet
  - Rose

Theme preferences are persisted in localStorage and will be restored on page reload.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Angular CLI 19.x or higher
- Modern web browser with WebSocket support

## Installation

```bash
# Install dependencies
npm install
```

## Development

Start the development server:

```bash
npm start
# or
ng serve
```

The application will be available at `http://localhost:4200`. The app will automatically reload when you change any source files.

### Code Generation

Angular CLI provides powerful code generation tools:

```bash
# Generate a new component
ng generate component my-component

# Generate a new service
ng generate service my-service

# Generate a new interface
ng generate interface my-interface

# List all available schematics
ng generate --help
```

## Building

Build the application for production:

```bash
# Production build
npm run build
# or
ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.

## Testing

### Unit Tests

Run unit tests with Karma:

```bash
npm test
# or
ng test
```

## Architecture

The web interface is built with a modular architecture:

- **Core Services**
  - `LogService`: Handles log collection, streaming, and filtering
  - `MetricsService`: Manages system metrics collection and visualization
  - `ServicesService`: Manages service discovery, monitoring, and status tracking
  - `ThemeService`: Controls application theming and user preferences
  - `TimeFormatService`: Handles consistent time formatting across the application
  - `WebsocketService`: Manages WebSocket communication and connection state

- **Components**
  - `ConnectionEventsDialogComponent`: Connection status and event history dialog
  - `LayoutComponent`: Main application layout with responsive navigation
  - `LogsComponent`: Real-time log viewing and filtering interface
  - `MetricsComponent`: System metrics visualization and analysis
  - `ServicesComponent`: Service management and monitoring interface

- **Features**
  - Real-time data updates via WebSocket
  - Responsive layout with Material Design
  - Theme switching with system preference detection
  - Advanced filtering and sorting capabilities
  - Service monitoring and management
  - Real-time metrics visualization
  - Log streaming and analysis

- **Design Patterns**
  - Component-based architecture
  - Reactive programming with RxJS
  - Dependency injection
  - Observable data streams
  - Event-driven communication
  - Singleton services

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -am 'Add new feature'`)
6. Push to the branch (`git push origin feature/improvement`)
7. Create a Pull Request

### Development Guidelines

- Follow Angular style guide
- Write comprehensive unit tests
- Document new features and changes
- Ensure responsive design
- Maintain accessibility standards
- Use TypeScript strict mode
- Follow Material Design principles