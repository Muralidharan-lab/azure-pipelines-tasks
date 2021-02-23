
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');
import { basicSetup, mockAzure } from './UnitTests/TestHelpers';

const Stats = require('fs').Stats;
const mockery = require('mockery');
const nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', 'a/**/(x|y).dsym');

/*
  dSyms folder structure:
  a
    f.txt
    b
      f.txt
      c
        d
          f.txt
        f.txt
        x.dsym
          x1.txt
          x2.txt
      d
        f.txt
        e
          f.txt
          f
            f.txt
            y.dsym
              y1.txt
*/

basicSetup();

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: 'Apple'
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        './test.ipa': true,
        'a': true,
        'a/f.txt': true,
        'a/b': true,
        'a/b/f.txt': true,
        'a/b/c': true,
        'a/b/c/f.txt': true,
        'a/b/c/d': true,
        'a/b/c/d/f.txt': true,
        'a/b/c/x.dsym': true,
        'a/b/c/x.dsym/x1.txt': true,
        'a/b/c/x.dsym/x2.txt': true,
        'a/b/d/f.txt': true,
        'a/b/d': true,
        'a/b/d/e': true,
        'a/b/d/e/f.txt': true,
        'a/b/d/e/f': true,
        'a/b/d/e/f/f.txt': true,
        'a/b/d/e/f/y.dsym': true,
        'a/b/d/e/f/y.dsym/y1.txt': true
    },
    'findMatch': {
        'a/**/(x|y).dsym': [
            'a/b/c/x.dsym',
            'a/b/d/e/f/y.dsym'
        ],
        './test.ipa': [
            './test.ipa'
        ]
    }
};
tmr.setAnswers(a);

fs.readdirSync = (folder: string) => {
    let files: string[] = [];

    if (folder === 'a') {
        files = [
            'f.txt',
            'b'
        ]
    } else if (folder === 'a/b') {
        files = [
            'f.txt',
            'c',
            'd'
        ]
    } else if (folder === 'a/b/c') {
        files = [
            'f.txt',
            'd',
            'x.dsym',
            'y.dsym'
        ]
    } else if (folder === 'a/b/c/x.dsym') {
        files = [
            'x1.txt',
            'x2.txt'
        ]
    } else if (folder === 'a/b/c/d') {
        files = [
            'f.txt',
            'e'
        ]
    } else if (folder === 'a/b/c/d/e') {
        files = [
            'f.txt',
            'f'
        ]
    } else if (folder === 'a/b/d/e/f') {
        files = [
            'f.txt',
            'y.dsym'
        ]
    } else if (folder === 'a/b/d/e/f/y.dsym') {
        files = [
            'y1.txt'
        ]
    }

    return files;
};

fs.statSync = (s: string) => {
    let stat = new Stats;
    stat.isFile = () => s.endsWith('.txt');
    stat.isDirectory = () => !s.endsWith('.txt');
    stat.size = 100;
    return stat;
}

fs.lstatSync = fs.statSync;

mockAzure();

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);

tmr.run();

mockery.deregisterMock('fs', fs);
mockery.deregisterMock('azure-blob-upload-helper', azureBlobUploadHelper);