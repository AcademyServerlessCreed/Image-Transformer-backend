import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

export class ImageResizerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 buckets
    const sourceBucket = new s3.Bucket(this, "SourceBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
      autoDeleteObjects: true, // For development - change for production
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ["*"], // Restrict in production
          allowedHeaders: ["*"],
        },
      ],
    });

    const resizedBucket = new s3.Bucket(this, "ResizedBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
      autoDeleteObjects: true, // For development - change for production
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ["*"], // Restrict in production
          allowedHeaders: ["*"],
        },
      ],
    });

    // Create SNS Topic

    const uploadHandler = new NodejsFunction(this, "UploadHandler", {
      entry: path.join(__dirname, "../lambda/upload/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        SOURCE_BUCKET: sourceBucket.bucketName,
      },
    });

    const resizeHandler = new NodejsFunction(this, "ResizeHandler", {
      entry: path.join(__dirname, "../lambda/resize/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      bundling: {
        nodeModules: ["sharp"],
        forceDockerBundling: true, // This is necessary for sharp to work & open docker
      },
      environment: {
        SOURCE_BUCKET: sourceBucket.bucketName,
        RESIZED_BUCKET: resizedBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
    });

    // Set up permissions
    sourceBucket.grantReadWrite(uploadHandler);
    sourceBucket.grantRead(resizeHandler);
    resizedBucket.grantWrite(resizeHandler);

    // Set up S3 event notification to SNS
    sourceBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(resizeHandler)
    );

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ImageAPI", {
      restApiName: "Image Resizer Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const uploadIntegration = new apigateway.LambdaIntegration(uploadHandler);
    api.root.addResource("upload").addMethod("POST", uploadIntegration);

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(
      this,
      "ImageDistribution",
      {
        defaultBehavior: {
          origin: new origins.S3Origin(resizedBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      }
    );

    // Output values
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: "API Gateway endpoint",
    });

    new cdk.CfnOutput(this, "CloudFrontDomain", {
      value: distribution.distributionDomainName,
      description: "CloudFront domain name",
    });
  }
}
