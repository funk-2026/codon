package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"codon-backend/internal/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Client struct {
	client     *s3.Client
	presigner  *s3.PresignClient
	bucket     string
}

var Client *S3Client

func Init() error {
	cfg := config.AppConfig

	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.S3Endpoint != "" {
			return aws.Endpoint{
				URL:               cfg.S3Endpoint,
				SigningRegion:     cfg.S3Region,
				HostnameImmutable: true,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.S3AccessKeyID,
			cfg.S3SecretAccessKey,
			"",
		)),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return fmt.Errorf("loading AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.S3Endpoint != "" {
			o.UsePathStyle = true
		}
	})

	Client = &S3Client{
		client:    s3Client,
		presigner: s3.NewPresignClient(s3Client),
		bucket:    cfg.S3Bucket,
	}
	return nil
}

// PresignPut generates a presigned PUT URL for direct upload from the client.
func (s *S3Client) PresignPut(ctx context.Context, key, contentType string, expiry time.Duration) (string, error) {
	req, err := s.presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("presigning PUT: %w", err)
	}
	return req.URL, nil
}

// PresignGet generates a presigned GET URL for downloading/viewing an object.
func (s *S3Client) PresignGet(ctx context.Context, key string, expiry time.Duration) (string, error) {
	req, err := s.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("presigning GET: %w", err)
	}
	return req.URL, nil
}

// DownloadObject fetches an object's content for server-side processing
// (e.g. the worker downloading a CSV to parse it). Caller must close the
// returned reader.
func (s *S3Client) DownloadObject(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("downloading object %s: %w", key, err)
	}
	return out.Body, nil
}

// BuildObjectKey constructs a namespaced key under the given purpose prefix.
func BuildObjectKey(purpose, fileName string) string {
	return fmt.Sprintf("%s/%s", purpose, fileName)
}
