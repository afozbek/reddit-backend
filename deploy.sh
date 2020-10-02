echo What should the version be?
read VERSION
echo $VERSION

docker build -t afozbek/lireddit:$VERSION .

docker push afozbek/lireddit:$VERSION

ssh root@$IP_ADRESS

docker pull afozbek/lireddit:1.0.x

docker tag afozbek/lireddit:1.0.x dokku/api:latest

dokku deploy api latest
