# Wavelength - Short Audio Platform

A mobile-first, short-form audio platform built with Next.js, Supabase, and Tailwind CSS.

## Features

- Record short audio snippets by holding down a button
- Automatic upload to Supabase storage
- Scrollable feed of audio snippets
- Autoplay functionality
- Mobile-first responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account
- Vercel account (for deployment)

## Setup

1. Clone the repository:

```bash
git clone [your-repo-url]
cd wavelength
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Set up Supabase:
   - Create a new project in Supabase
   - Create a storage bucket named 'audio-snippets'
   - Set appropriate storage policies

5. Run the development server:

```bash
npm run dev
```

## Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Tech Stack

- Next.js 13+ (App Router)
- Supabase (Backend & Storage)
- Tailwind CSS (Styling)
- TypeScript 