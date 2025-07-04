import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';

export async function loader({ context, request }: LoaderFunctionArgs) {
  const env = context.cloudflare?.env as any;
  const llmManager = LLMManager.getInstance(env);

  // Get API keys and settings from cookies for GET requests
  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  try {
    const models = await llmManager.updateModelList({
      apiKeys,
      providerSettings,
      serverEnv: env,
    });

    return Response.json({
      modelList: models,
      providers: [
        {
          name: 'Anthropic',
          staticModels: llmManager.getStaticModelList(),
          getApiKeyLink: 'https://console.anthropic.com/settings/keys',
          labelForGetApiKey: 'Get Anthropic API Key',
          icon: 'i-simple-icons:anthropic',
        },
      ],
      defaultProvider: {
        name: 'Anthropic',
        staticModels: llmManager.getStaticModelList(),
        getApiKeyLink: 'https://console.anthropic.com/settings/keys',
        labelForGetApiKey: 'Get Anthropic API Key',
        icon: 'i-simple-icons:anthropic',
      },
    });
  } catch (error: any) {
    console.error('Error in models loader:', error);

    // Return static Anthropic models as fallback
    const staticModels = llmManager.getStaticModelList();
    return Response.json({
      modelList: staticModels,
      providers: [
        {
          name: 'Anthropic',
          staticModels: staticModels,
          getApiKeyLink: 'https://console.anthropic.com/settings/keys',
          labelForGetApiKey: 'Get Anthropic API Key',
          icon: 'i-simple-icons:anthropic',
        },
      ],
      defaultProvider: {
        name: 'Anthropic',
        staticModels: staticModels,
        getApiKeyLink: 'https://console.anthropic.com/settings/keys',
        labelForGetApiKey: 'Get Anthropic API Key',
        icon: 'i-simple-icons:anthropic',
      },
    });
  }
}

export async function action({ context, request }: ActionFunctionArgs) {
  const env = context.cloudflare?.env as any;
  const formData = await request.formData();
  const apiKeys = JSON.parse(formData.get('apiKeys') as string);
  const settings = JSON.parse(formData.get('settings') as string);

  const llmManager = LLMManager.getInstance(env);

  try {
    const models = await llmManager.updateModelList({
      apiKeys,
      providerSettings: settings,
      serverEnv: env,
    });

    return Response.json(models);
  } catch (error: any) {
    console.error('Error updating model list:', error);

    // Return static Anthropic models as fallback
    return Response.json(llmManager.getStaticModelList());
  }
}
