import type { IProviderSetting } from '~/types/model';
import { BaseProvider } from './base-provider';
import type { ModelInfo } from './types';
import { AnthropicProvider } from './registry';

export class LLMManager {
  private static _instance: LLMManager;
  private _provider: BaseProvider;
  private readonly _env: any = {};

  private constructor(_env: Record<string, string>) {
    this._provider = new AnthropicProvider();
    this._env = _env;
  }

  static getInstance(env: Record<string, string> = {}): LLMManager {
    if (!LLMManager._instance) {
      LLMManager._instance = new LLMManager(env);
    }

    return LLMManager._instance;
  }

  get env() {
    return this._env;
  }

  getProvider(): BaseProvider {
    return this._provider;
  }

  getAllProviders(): BaseProvider[] {
    return [this._provider];
  }

  getModelList(): ModelInfo[] {
    return this._provider.staticModels;
  }

  async updateModelList(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    serverEnv?: Record<string, string>;
  }): Promise<ModelInfo[]> {
    const { apiKeys, providerSettings, serverEnv } = options;

    // If no API keys are provided, return only static models
    if (!apiKeys || !apiKeys['Anthropic']) {
      return this.getStaticModelList();
    }

    try {
      const dynamicModels =
        (await this._provider.getDynamicModels?.(apiKeys, providerSettings?.['Anthropic'], serverEnv)) || [];

      const staticModels = this._provider.staticModels || [];
      const dynamicModelNames = dynamicModels.map((d) => d.name);
      const filteredStaticModels = staticModels.filter((m) => !dynamicModelNames.includes(m.name));

      const modelList = [...dynamicModels, ...filteredStaticModels];
      modelList.sort((a, b) => a.name.localeCompare(b.name));

      return modelList;
    } catch (err) {
      console.log(`Error getting dynamic models from Anthropic:`, err);
      return this.getStaticModelList();
    }
  }

  getStaticModelList(): ModelInfo[] {
    return this._provider.staticModels || [];
  }

  async getModelListFromProvider(
    providerArg: BaseProvider,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: Record<string, string>;
    },
  ): Promise<ModelInfo[]> {
    // Only support Anthropic provider
    if (providerArg.name !== 'Anthropic') {
      throw new Error(`Only Anthropic provider is supported`);
    }

    return this.updateModelList(options);
  }

  getStaticModelListFromProvider(providerArg: BaseProvider): ModelInfo[] {
    if (providerArg.name !== 'Anthropic') {
      throw new Error(`Only Anthropic provider is supported`);
    }

    return this.getStaticModelList();
  }

  getDefaultProvider(): BaseProvider {
    return this._provider;
  }
}
