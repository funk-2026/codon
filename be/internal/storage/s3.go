package storage

import (
	"bytes"
	"context"
	"errors"
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
	Store = Client
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

// ── Backend abstraction ───────────────────────────────────────────────────────

// ObjectInfo is what HeadObject reports.
type ObjectInfo struct {
	Size        int64
	ContentType string
}

// Backend is the object-store surface the media pipeline needs. The S3/R2
// client implements it; tests use MemBackend.
type Backend interface {
	// PresignPutSized signs a PUT that must carry exactly `size` bytes and this content type.
	PresignPutSized(ctx context.Context, key, contentType string, size int64, expiry time.Duration) (string, error)
	PresignGet(ctx context.Context, key string, expiry time.Duration) (string, error)
	DownloadObject(ctx context.Context, key string) (io.ReadCloser, error)
	PutObject(ctx context.Context, key, contentType string, data []byte) error
	HeadObject(ctx context.Context, key string) (ObjectInfo, error)
	DeleteObject(ctx context.Context, key string) error
}

// Store is the backend used by the media pipeline (nil = storage not configured).
var Store Backend

func (s *S3Client) PresignPutSized(ctx context.Context, key, contentType string, size int64, expiry time.Duration) (string, error) {
	req, err := s.presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("presigning sized PUT: %w", err)
	}
	return req.URL, nil
}

func (s *S3Client) PutObject(ctx context.Context, key, contentType string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
		Body:        bytes.NewReader(data),
	})
	return err
}

func (s *S3Client) HeadObject(ctx context.Context, key string) (ObjectInfo, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		return ObjectInfo{}, err
	}
	info := ObjectInfo{}
	if out.ContentLength != nil {
		info.Size = *out.ContentLength
	}
	if out.ContentType != nil {
		info.ContentType = *out.ContentType
	}
	return info, nil
}

func (s *S3Client) DeleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	return err
}

// ErrNotFound is returned by backends when an object does not exist.
var ErrNotFound = errors.New("object not found")
