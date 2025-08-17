# Releasing

- Check codes

  ```bash
  deno fmt --check
  deno lint
  deno check *.js */*.js

  rm -rf yarn.lock node_modules
  yarn install
  yarn outdated

  # Upgrade the packages version on package.json if necessary.
  # Update the version in package.json
  # yarn install again if necessary

  yarn run check
  yarn run lint
  ```

- Update the version in [manifest.json](/manifest.json).

- Copy the folder to a temporary location

  ```bash
  cp -arp ../eparto-virtual-phone /tmp/
  cd /tmp/eparto-virtual-phone
  ```

- Disable debug logging in [config.js](/common/config.js).

- Remove the development files and create the zip file:

  ```bash
  rm -rf .git .gitignore docs LICENSE README.md google*.html index.html
  rm -rf eslint.config.js node_modules package.json .prettier* yarn.lock
  ls -alh

  zip -r eparto-virtual-phone .
  ```

- Open the developer dashboard on Chrome Web Store

- Select Eparto Virtual Phone as item

- Go to the package tab

- Upload new package

- Save draft

- Submit for review
