# Releasing

- Check codes

  ```bash
  deno fmt --check
  deno lint
  deno check *.js */*.js
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
  rm -rf .git .gitignore docs LICENSE README.md google*.html
  ls -alh

  zip -r eparto-virtual-phone .
  ```

- Open the developer dashboard on Chrome Web Store

- Select Eparto Virtual Phone as item

- Go to the package tab

- Upload new package

- Save draft

- Submit for review
