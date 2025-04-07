package gmsclient

import (
	"context"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type Client interface {
	ValidateKey(context.Context, cloudmigration.CloudMigrationSession) error
	MigrateData(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.MigrateDataRequest) (*cloudmigration.MigrateDataResponse, error)
	StartSnapshot(context.Context, cloudmigration.CloudMigrationSession) (*cloudmigration.StartSnapshotResponse, error)
	GetSnapshotStatus(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.CloudMigrationSnapshot, int) (*cloudmigration.GetSnapshotStatusResponse, error)
	CreatePresignedUploadUrl(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.CloudMigrationSnapshot) (string, error)
}

const logPrefix = "cloudmigration.gmsclient"
