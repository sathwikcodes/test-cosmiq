import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import type { GitHubContent } from '~/types/GitHub';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');

  if (!repo) {
    return new Response('Repository parameter is required', { status: 400 });
  }

  try {
    // Fetch repository contents from GitHub API
    const response = await fetch(`https://api.github.com/repos/${repo}/contents`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Cosmiq-App',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const contents = (await response.json()) as GitHubContent[];
    const files: { name: string; path: string; content: string }[] = [];

    // Recursively fetch all files in the repository
    for (const item of contents) {
      if (item.type === 'file') {
        try {
          const fileResponse = await fetch(item.download_url);
          if (fileResponse.ok) {
            const content = await fileResponse.text();
            files.push({
              name: item.name,
              path: item.path,
              content: content,
            });
          }
        } catch (error) {
          console.error(`Error fetching file ${item.path}:`, error);
        }
      } else if (item.type === 'dir') {
        // Recursively fetch directory contents
        const dirResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${item.path}`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Cosmiq-App',
          },
        });

        if (dirResponse.ok) {
          const dirContents = (await dirResponse.json()) as GitHubContent[];
          for (const dirItem of dirContents) {
            if (dirItem.type === 'file') {
              try {
                const fileResponse = await fetch(dirItem.download_url);
                if (fileResponse.ok) {
                  const content = await fileResponse.text();
                  files.push({
                    name: dirItem.name,
                    path: dirItem.path,
                    content: content,
                  });
                }
              } catch (error) {
                console.error(`Error fetching file ${dirItem.path}:`, error);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify(files), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching GitHub repository:', error);
    return new Response('Error fetching repository contents', { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Handle POST requests if needed
  return new Response('Method not allowed', { status: 405 });
}
