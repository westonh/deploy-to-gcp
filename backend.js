var Firebase = require('firebase'),
  child_process = require('child_process'),
  temp = require('temp'),
  fs = require('fs');
var config = require('./config.json');

temp.track();

var ref = new Firebase('https://deploy-to-gcp-weston.firebaseio.com/');
var deployRequestsRef = ref.child('deploy_requests');
var deployLogsRef = ref.child('deploy_logs');

ref.authWithCustomToken(config.firebase_token, function(error) {
  failOnError('auth', error);
});

deployRequestsRef.on('child_added', function(s) {
  console.log('Got new deploy request:', s.key());
  s.ref().remove(function(error) {
    failOnError('remove deploy request', error);
  });
  doDeploy(s);
}, function(error) {
  failOnError('child_added on /deploys/', error);
});

function doDeploy(snapshot) {
  var logRef = deployLogsRef.child(snapshot.key());
  var git_repo = snapshot.child('git_repo').val();
  var project_id = snapshot.child('project_id').val();
  var oauth_token = snapshot.child('oauth_token').val();

  cloneRepo(git_repo, logRef, function(error, dir) {
    if (!error) {
      deployApp(dir, project_id, oauth_token, logRef, function(error) {
      });
    }
  });
}

function cloneRepo(git_repo, logRef, onComplete) {
  logRef.push('Cloning git repo ' + git_repo);
  temp.mkdir('git_repo', function(error, dirPath) {
    failOnError('create temp dir', error);
    var cmd = 'git clone ' + git_repo + ' ' + dirPath;
    console.log('Executing:', cmd);
    child_process.exec(cmd, function(error, stdout, stderr) {
      if (error && stderr) {
        logRef.push('Failed to clone repo: ' + stderr.toString());
        onComplete(error);
      } else if (error) {
        logRef.push('Failed to clone repo: ' + error.toString());
        onComplete(error);
      } else {
        console.log('git complete.');
        logRef.push('Git clone complete.');
        onComplete(null, dirPath);
      }
    });
  });
}

function deployApp(dir, project_id, oauth_token, logRef, onComplete) {
  setProjectId(dir, project_id, function(error) {
    failOnError('replace application in app.yaml file', error);
    console.log(dir + ' ready to deploy.');
    deployToAppEngine(dir, oauth_token, project_id, logRef, function(error) {
      // No action.  It should have updated its own status.
    });
  });
}

function deployToAppEngine(dir, oauth_token, project_id, logRef, onComplete) {
  var cmd = 'appcfg.py'
  var args = ['--oauth2_access_token', oauth_token, 'update', dir];
  var child = child_process.spawn(cmd, args);
  logRef.push('Deploying to AppEngine.');
  child.stdout.on('data', function(data) {
    logRef.push(data.toString());
  });
  child.stderr.on('data', function(data) {
    logRef.push(data.toString());
  });
  child.on('close', function(code) {
    if (code !== 0) {
      logRef.push('Deploy failed.');
    } else {
      logRef.push('Deploy succeeded!  Go to https://' + project_id + '.appspot.com/');
      onComplete(null);
    }
  });
}

function setProjectId(dir, project_id, onComplete) {
  // This is pretty hacky.
  var file = dir + '/app.yaml';
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      return onComplete(err);
    }
    var result = data.replace(/^application: .*$/m, 'application: ' + project_id);

    fs.writeFile(file, result, 'utf8', function (err) {
       return onComplete(err);
    });
  });
}

function failOnError(what, error) {
  if (error) {
    console.error(what + ' failed:', error);
    process.exit(1);
  }
}
