To deploy frontend:

1. firebase deploy

To set up backend:

1. Provision machine with node.js.
2. Clone this repo.
3. npm install

4. Install AppEngine stuff.
   Ideally this would be `sudo gcloud components update app gae-go gae-java gae-python preview` But I can't figure out how to make gcloud use an arbitrary oauth2 access token.  So for now, backend.js uses appcfg.py.  So you need to have that on your path.  Right now I have the go appengine SDK on the path, so I think this probably only works for Go appengine apps right now. :-/

5. node backend.js

