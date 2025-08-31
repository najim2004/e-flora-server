# DigitalKrishi Server

A fully OOP-structured Express server with TypeScript, Mongoose, and comprehensive logging.

## Features

- ✅ **TypeScript** - Strongly typed codebase
- ✅ **Express** - Fast, unopinionated web framework
- ✅ **Mongoose** - MongoDB object modeling with validation
- ✅ **OOP Structure** - Classes, interfaces, and clean architecture
- ✅ **JWT Authentication** - Secure user login and registration
- ✅ **Advanced Logging** - Winston + Morgan for detailed API tracking
- ✅ **Error Handling** - Centralized error handling with proper HTTP status codes
- ✅ **Input Validation** - Request data validation
- ✅ **Development Tools** - Nodemon, ESLint, and Prettier configured

## Project Structure

```
/digitalkrishi-server
├── src/
│   ├── config/          # Configuration modules
│   ├── controllers/     # Request handlers
│   ├── interfaces/      # TypeScript interfaces
│   ├── middlewares/     # Express middlewares
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── logs/                # Application logs
├── .env                 # Environment variables
├── .env.example         # Environment variables template
├── nodemon.json         # Nodemon configuration
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md            # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd digitalkrishi-server
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server

```bash
npm run dev
```

## API Endpoints

### Authentication

- **POST /api/auth/register** - Register a new user
  - Body: `{ "name": "User Name", "email": "user@example.com", "password": "password123" }`

- **POST /api/auth/login** - Login a user
  - Body: `{ "email": "user@example.com", "password": "password123" }`

## Scripts

- `npm run dev` - Start development server with Nodemon
- `npm run build` - Build the project for production
- `npm start` - Start the production server

## Logging

Logs are stored in the `logs` directory:

- `all.log` - All log levels
- `error.log` - Error logs only

## License

[MIT](LICENSE)
