/**
 * DDD Taiwan 報名系統 CDK Stack（Phase 3a）
 * Lambda + HTTP API + DynamoDB + SES 寄信權限 + Route53 自訂網域（register.ddd-tw.com）
 *
 * 最小權限原則：Lambda 只拿得到這張表的 CRUD 與 SES SendEmail，無其他權限。
 */

import { Stack, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RegistrationStack extends Stack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    const domainName = props.domainName ?? 'register.ddd-tw.com';
    const zoneName = props.zoneName ?? 'ddd-tw.com';
    const sesFrom = props.sesFrom ?? 'DDD Taiwan <tickets@ddd-tw.com>';

    // ---- DynamoDB 單表 ----
    const table = new dynamodb.Table(this, 'RegistrationTable', {
      tableName: 'dddtw-registration',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN, // 報名資料絕不隨 stack 刪除
    });

    // ---- Lambda ----
    const fn = new lambda.Function(this, 'RegistrationFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        ALLOWED_ORIGIN: 'https://ddd-tw.com',
        SES_FROM: sesFrom,
        // STAFF_KEY 不放 CDK 程式碼：部署後用
        //   aws lambda update-function-configuration 或 SSM Parameter 設定
        STAFF_KEY: process.env.STAFF_KEY ?? 'CHANGE_ME_AFTER_DEPLOY',
      },
    });
    table.grantReadWriteData(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'], // SES v2 SendEmail 以 identity 條件細分需另設；社群單一網域可接受
      conditions: { StringLike: { 'ses:FromAddress': '*@ddd-tw.com' } },
    }));

    // ---- HTTP API（自訂網域可用 -c skipDns=true 跳過：本機 synth 驗證或首次部署） ----
    const skipDns = this.node.tryGetContext('skipDns') === 'true';

    if (skipDns) {
      const api = new apigwv2.HttpApi(this, 'RegistrationApi', {
        defaultIntegration: new HttpLambdaIntegration('Fn', fn),
      });
      new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    } else {
      const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });
      const cert = new acm.Certificate(this, 'Cert', {
        domainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });
      const domain = new apigwv2.DomainName(this, 'Domain', { domainName, certificate: cert });

      new apigwv2.HttpApi(this, 'RegistrationApi', {
        defaultIntegration: new HttpLambdaIntegration('Fn', fn),
        defaultDomainMapping: { domainName: domain },
      });

      new route53.ARecord(this, 'AliasRecord', {
        zone,
        recordName: domainName.replace(`.${zoneName}`, ''),
        target: route53.RecordTarget.fromAlias(
          new targets.ApiGatewayv2DomainProperties(
            domain.regionalDomainName, domain.regionalHostedZoneId
          )
        ),
      });
      new CfnOutput(this, 'ApiUrl', { value: `https://${domainName}` });
    }

    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
