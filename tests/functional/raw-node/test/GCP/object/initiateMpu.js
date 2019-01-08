const assert = require('assert');
const async = require('async');
const arsenal = require('arsenal');
const { GCP } = arsenal.storage.data.external;
const { makeGcpRequest } = require('../../../utils/makeRequest');
const { gcpRequestRetry, setBucketClass, genUniqID } =
    require('../../../utils/gcpUtils');
const { getRealAwsConfig } =
    require('../../../../aws-node-sdk/test/support/awsConfig');

const credentialOne = 'gcpbackend';
const bucketNames = {
    main: {
        Name: `somebucket-${genUniqID()}`,
        Type: 'MULTI_REGIONAL',
    },
    mpu: {
        Name: `mpubucket-${genUniqID()}`,
        Type: 'MULTI_REGIONAL',
    },
};

describe('GCP: Initiate MPU', function testSuite() {
    this.timeout(180000);
    let config;
    let gcpClient;

    before(done => {
        config = getRealAwsConfig(credentialOne);
        gcpClient = new GCP(config);
        async.eachSeries(bucketNames,
            (bucket, next) => gcpRequestRetry({
                method: 'PUT',
                bucket: bucket.Name,
                authCredentials: config.credentials,
                requestBody: setBucketClass(bucket.Type),
            }, 0, err => {
                if (err) {
                    process.stdout.write(`err in creating bucket ${err}\n`);
                }
                return next(err);
            }),
        done);
    });

    after(done => {
        async.eachSeries(bucketNames,
            (bucket, next) => gcpRequestRetry({
                method: 'DELETE',
                bucket: bucket.Name,
                authCredentials: config.credentials,
            }, 0, err => {
                if (err) {
                    process.stdout.write(`err in deleting bucket ${err}\n`);
                }
                return next(err);
            }),
        done);
    });

    it('Should create a multipart upload object', done => {
        const keyName = `somekey-${genUniqID()}`;
        const specialKey = `special-${genUniqID()}`;
        async.waterfall([
            next => gcpClient.createMultipartUpload({
                Bucket: bucketNames.mpu.Name,
                Key: keyName,
                Metadata: {
                    special: specialKey,
                },
            }, (err, res) => {
                assert.equal(err, null,
                    `Expected success, but got err ${err}`);
                return next(null, res.UploadId);
            }),
            (uploadId, next) => {
                const mpuInitKey = `${keyName}-${uploadId}/init`;
                makeGcpRequest({
                    method: 'GET',
                    bucket: bucketNames.mpu.Name,
                    objectKey: mpuInitKey,
                    authCredentials: config.credentials,
                }, (err, res) => {
                    if (err) {
                        process.stdout
                            .write(`err in retrieving object ${err}`);
                        return next(err);
                    }
                    assert.strictEqual(res.headers['x-goog-meta-special'],
                        specialKey);
                    return next(null, uploadId);
                });
            },
            (uploadId, next) => gcpClient.abortMultipartUpload({
                Bucket: bucketNames.main.Name,
                MPU: bucketNames.mpu.Name,
                UploadId: uploadId,
                Key: keyName,
            }, err => {
                assert.equal(err, null,
                    `Expected success, but got err ${err}`);
                return next();
            }),
        ], done);
    });
});
