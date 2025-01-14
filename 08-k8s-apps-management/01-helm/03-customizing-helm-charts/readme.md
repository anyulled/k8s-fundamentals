# Customizing Charts with Helm Templates

## Agenda

* Why Helm Templates?
* How does the Helm Templates engine work?
* How does the Helm Template engine run?
* Playing with Helm Template Values
* Adding Logic to Helm Template

## Why Helm Templates?

In previous demos we have changed manually the manifests. This is not the way...Instead, they should be externilized and automatically replaced when we call the `helm install` command.

This is what the `Helm templates` do for us.

Another reason, is that we should be able to install two release of the same chart on different clusters, on the same cluster, or in the same namespace (the name of all K8s resource must be unique). If we want to install two releases of the same application, we need a way to generate unique names.

> Solution: Generate the names of K8s objects based on Helm `release` name.

```yaml
# 'dev' Release
apiVersion: v1
kind: Service
metadata: 
  labels:
    name: dev-frontend
  name: dev-frontend
# ....
```

```yaml
# 'test' Release
apiVersion: v1
kind: Service
metadata: 
  labels:
    name: test-frontend
  name: test-frontend
# ....
```

## What Is Helm Template Engine?

Helm templates are processed by Helm template engine.

### Other Template Engines

| stack          | Template engine |      Directives      |
| -------------- | :-------------: | :------------------: |
| System         |      bash       |      ${ENV_VAR}      |
| System         |       bat       |      %ENV_VAR%       |
| Web dev        |       Php       | <?php echo $title ?> |
| Web dev        |  Jsp, Asp, EJS  |      <%= var%>       |
| Code generator |    Velocity     |         $var         |
| Code generator |     Yeoman      |      <%= var %>      |
| Code generator |  Go Templates   |      {{ var }}       |


The principle is always the same. You insert directives in your code. The directives are distinguished from the rest of the code with some characters by convention. 

Those directives are replaced by values or execute some code when they are processed by the temperate engine. 

### Go Template Engine

```yaml
#Template
apiVersion: v1
kind: Service
metadata: 
  name: {{.name}}
```

```yaml
#Object
type: NodePort
name: myservice
port: 80
```

> TEMPLATE + OBJECT = MANIFEST

```yaml
#Manifest
apiVersion: v1
kind: Service
metadata: 
  name: myservice
```

The `.name` directive is replaced by the value of the name property of the object, which is `myservice`. 

The result is a manifest where the directive has been replaced by the value of the name property.

* [Go template documentation](http://golang.org/pkg/text/template)
* [Go‑Template project](http://github.com/phcollignon/Go-Template)

### Helm Template Engine

```yaml
#Template
apiVersion: v1
kind: Service
metadata: 
  name: {{.Values.name}}
```

```yaml
#values.yaml
type: NodePort
name: myservice
port: 80
```

> TEMPLATE + values.yaml = MANIFEST

```yaml
# Template
apiVersion: v1
kind: Service
metadata: 
  name: myservice
```

The Helm template engine is actually based on the Go template engine.

* Different sources
  * `values.yaml`
  * Predefined on Chart defininition
  * Release runtime metadata

```yaml
#Chart
Name: mychart
Version: 1.0.0
```

```yaml
#Release
Name: myrelease
Revision: 2
```

> TEMPLATE + values.yaml + Chart + Release = MANIFEST

The Helm template also provides additional functions:

```yaml
#Sprig functions
default
quote
base64
```

> TEMPLATE + values.yaml + Chart + Release + Sprig Functions = MANIFEST

Except for those add‑ons, the Helm template engine works the same as the Go template engine. It is the Go template engine!

### Helm Template Execution

But where and when does the Helm template engine run? It runs on the client side. When you lunch the `helm install` or `helm upgrade` command, before sending the file definition to the Kubernetes API, Helm first processes your temperate with the template engine, which executes the directives or replace them with values to create a manifest. 

Then Helm sends the result to the Kubernetes API. 

Helm doesn't store a history of the templates on the server side. It only stores a history of the processed templates, so the manifest, in some secrets in the Kubernetes cluster. But for information and debugging purposes, Helm also stores the values that have been used to generate the manifest.

> Values are stored in Kubernetes secrets in the Base64 encoded gzip archive

## Demo: Helm data in cluster

[Demo: Helm data in cluster](./01-helm-data/readme.md)

### Helm Template Test

|          Static           |                     Dynamic                     |
| :-----------------------: | :---------------------------------------------: |
|   helm template [chart]   | helm install [release][chart] --dry-run --debug |
| works without k8s cluster |      real helm install but without commit       |
|    static release name    |           can generate a release name           |

The static method works locally and does not contact the Kubernetes API, so it has fewer features, such as generating release names and some runtime checks.

> Use the static method in the first stages of your development and the dynamic one later

Dynamic method debug parameter outputs in the standard error, you have to redirect:

```bash
helm template [chart]
helm install [release][chart] --debug --dry-run
helm install [release][chart] --debug --dry-run 2>&1 | less
```

## Helm Template Data

> Template contains directives that are replaced by values or that execute code.

### Helm Template Values

Which data are available in the Helm template?

* **values.yaml**
* **other-file.yaml** - helm install -f file
* **variables** - helm install --set foo=bar

```yaml
#Template
apiVersion: v1
kind: Service
metadata:
  name: {{.Values.service.name}}
```

```yaml
#values.yaml
service:
  type: NodePort
  name: myservice
  port: 80
```

Values for templates can be supplied in different ways. They can be defined in the `values.yaml` file located at the root of the chart directory **or in any other YAML file**.

You can also set custom values in the command line with `‑‑set name=value`.

> When the user sets a custom value, that value overrides the values defined in the chart's values file. 

Those values are organized in a nested way, and you can access them with `.Values`, *dot, refers to the root*, and *Values to the value's data*. Then add `.property` to access the child, add `.subProperty` for the grandchild, and so on. 

We can define this structured data using a `schema`

### JSON Schema File

```yaml
service:
  type: NodePort
  name: myservice
  port: 80
  labels:
    - name: name1
    - name: name2
```

```json
{
  "service": {
    "type": "NodePort",
    "name": "myservice",
    "port": 80,
    "labels": [
      {
        "name": "name1"
      },
      {
        "name": "name2"
      }
    ]
  }
}
```

Every YAML file can be written in a JSON format. For this JSON file, there is a way to define the structure, which is the JSON schema. 

[JOSN Schema specs](http://json-schema.org)

If we want to use the `schema`, we have to store it, in a file named `values.schema.json`

```
├─ chart/
    ├─ charts/
    ├─ Chart.yaml
    ├─ templates/
    |  ├─ NOTES.txt
    ├─ values.schema.json
    ├─ values.yaml
```

This schema allows Helm to validate the `value.yaml` file. The validation occurs each time you call `helm install`, `helm update`, or `helm template`. Helm validates the structure and the types, and it also validates the required values.

### Helm Template Built-in Objects

Data can come from other sources than the values file. They can come from the chart file.

```yaml
#Template
apiVersion: v1
kind: Service
metadata:
  name: {{.Chart.Name}}
```

```yaml
version: 1.0.0
name: mychart
appVersion: "2.1"
```

In this case we access the data with `.Chart` and not `.Values`.

They can come from the release's runtime data and be accessed with `.Release`.

```yaml
#Template
apiVersion: v1
kind: Service
metadata:
  name: {{.Release.Name}}
```

```
#Release
Release.Name
Release.Namespace
Release.Service
Release.Revision
Release.IsUpgrade
Release.IsInstall
```

You can also get the data about the Kubernetes cluster with `.Capabilities`.

```yaml
#Template
apiVersion: v1
kind: Service
metadata:
  annotations:  K8s:{{.Capabilities.KubeVersion}}
```

```
#Kubernetes
Capabilities.APIVersions
Capabilities.KuberVersion.Minor
Capabilities.KuberVersion.Major
```

You can also include the content of files in your template with `.Files` object. 

> The file path is relative to the root of your chart and that the files cannot be located in the template directory.

```yaml
#Template
apiVersion: v1
kind: Service
metadata:
  annotations:  data:{{.Files.Get conf.ini}}
```

```
#Files
conf.ini
```

You can access some data about the `template` itself, such as its name.

```yaml
#Template
apiVersion: v1
kind: Service
metadata:
  annotations:  tpl:{{.Template.Name}}
```

```
#Templates
Template.Name
Template.BasePath
```

### Values and Sub-charts

What about the values in the case of an umbrella chart?

Every sub‑chart can be used as a standalone chart or as a sub‑chart. So each sub‑chart contains its own `values.yaml` file, which contains the default values for that chart. The parent chart also has a `values.yaml` file with its own properties, **but it can override the values from a child chart under a property that has the name of that chart**. 

## Demo: Values and Subcharts

[Demo: Values and Subcharts](02-values-and-subcharts/readme.md)

## Demo: Customizing Frontend Chart Values

[## Demo: Customizing Frontend Chart Values](03-customizing-frontend-chart-values/readme.md)