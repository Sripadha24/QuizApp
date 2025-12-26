
# AI Quiz Pro

A secure, production-ready AI Quiz Generator built with React and Google Gemini.

## Features
- Dynamic quiz generation based on any topic.
- Customizable difficulty and question count.
- Mobile-first responsive design using Tailwind CSS.
- Secure serverless backend to protect API keys.

## Local Setup

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Environment Variables:**
   Create a `.env` file in the root directory and add your API key:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key
   ```
4. **Run development server:**
   ```bash
   npm run dev
   ```

## Deployment to Vercel

This app is designed to work out of the box with Vercel Serverless Functions.

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your repository.
4. In the **Environment Variables** section, add:
   - `GEMINI_API_KEY`: [Your Google Gemini API Key]
5. Click **Deploy**.

The Vercel platform will automatically treat files in the `/api` directory as serverless endpoints.

## Security
This application ensures that your `GEMINI_API_KEY` is never exposed to the client-side browser. All AI processing happens in a secure server-side Vercel function.
