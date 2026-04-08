import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coco.chatai',
  appName: 'Coco Chat AI',
  webDir: '.',
  server: {
    androidScheme: 'https',
    hostname: 'app.coco.chatai',
    allowNavigation: [
      'https://api.deepseek.com/*',
      'https://api.moonshot.cn/*',
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://open.bigmodel.cn/*',
      'https://dashscope.aliyuncs.com/*',
      'https://*.aliyuncs.com/*'
    ]
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webViewLimitsNavigations: true,
    backgroundColor: '#fafaf8'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#fafaf8'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
