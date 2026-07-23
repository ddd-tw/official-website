#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { RegistrationStack } from '../lib/registration-stack.mjs';

const app = new App();
new RegistrationStack(app, 'DddtwRegistration', {
  // Route53 zone lookup 需要明確的 account/region
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
});
