# OpenMuse

This project is a web application designed to manage and showcase LoRA (Low-Rank Adaptation) assets specifically created for open-source video generation models like Wan, LTXV, and Hunyuan.

It serves as a curated gallery where users can browse, filter, and view LoRAs along with video examples generated using them. The platform supports user uploads (subject to potential admin approval) of both LoRA assets and their corresponding showcase videos.

## Key Features

*   Browse and filter LoRAs by base model, approval status, and name.
*   View detailed information about each LoRA.
*   Watch video examples generated with specific LoRAs.
*   Upload new LoRA assets (name, description, base model, type, link).
*   Upload showcase videos associated with specific LoRAs.
*   User authentication (via Supabase).
*   Admin approval workflow for curating LoRAs.

## Tech Stack

*   **Frontend:** React with TypeScript
*   **UI Framework:** Tailwind CSS with shadcn/ui
*   **Build Tool:** Vite
*   **Backend/BaaS:** Supabase (Authentication, Database, Storage)
*   **Data Fetching:** React Query (`@tanstack/react-query`)
*   **Routing:** React Router (`react-router-dom`)

## Local Development Setup

To work on this project locally:

1.  **Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) (v18 or later recommended) and npm installed. Using [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) is advised.
2.  **Clone the repository:**
    ```sh
    git clone <YOUR_GIT_REPOSITORY_URL>
    cd <YOUR_PROJECT_DIRECTORY>
    ```
3.  **Install dependencies:**
    ```sh
    npm install 
    # or if you use bun: bun install
    ```
4.  **Environment Variables:**
    *   You will need to set up Supabase environment variables. Create a `.env.local` file in the root directory.
    *   Copy the contents of `.env.example` (if it exists) or add the necessary Supabase keys:
        ```dotenv
        VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
        VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY 
        ```
    *   Obtain these values from your Supabase project settings.
5.  **Run the development server:**
    ```sh
    npm run dev
    # or: bun run dev
    ```
    The application should now be running, typically at `http://localhost:8080`.
