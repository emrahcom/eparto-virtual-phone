# Releasing

Update the version in [manifest.json](/manifest.json).

Disable debug logging in [config.js](/common/config.js).

Remove the development files and create the zip file:

```bash
cp -arp ../eparto-virtual-phone /tmp/

cd /tmp/eparto-virtual-phone
rm -rf .git .gitignore docs LICENSE
ls -alh

zip -r eparto-virtual-phone .
```
