

/**
 * XMLscene class, representing the scene that is to be rendered.
 */
class MyScene extends CGFscene {
    /**
     * @constructor
     * @param {MyInterface} myinterface 
     */
    constructor(myinterface) {
        super(); // noop

        this.myinterface = myinterface;
        this.lightValues = {};

        this.newCamera = false;
    }

    /**
     * Initializes the scene and the camera, setting some WebGL defaults.
     * @param {CGFApplication} application
     */
    init(application) {
        super.init(application);

        this.count = 0;

        this.selectedCamera = null;

        this.graphLoaded = false;

        this.initDefaults();
        this.expert = new Rectangle(this, {x1: 0, x2: 4, y1: 0, y2: 4});

        this.enableTextures(true);
        this.gl.clearDepth(100.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);
    }

    /**
     * Initializes the scene's default camera, lights and axis.
     */
    initDefaults() {
        this.axis = new CGFaxis(this);

        this.camera = new CGFcamera(0.4, 0.1, 500,
            vec3.fromValues(15, 15, 15), vec3.fromValues(0, 0, 0));
    }

    /* Handler called when the graph is finally loaded. 
     * As loading is asynchronous, this may be called already after the application has started the run loop
     */
    onGraphLoaded() {
        this.initAxis();

        this.initViews();

        this.initAmbient();

        this.initLights();

        this.initTextures();

        this.initMaterials();

        this.initPrimitives();

        this.graphLoaded = true;
    }

    initAxis() {
        const scene = this.graph.yas.scene;

        const axisLength = scene.data.axis_length;
        this.axis = new CGFaxis(this, axisLength, AXIS_THICKNESS);
    }

    initViews() {
        const views = this.graph.yas.views;

        this.selectedCamera = views.data.default;

        this.newCamera = true;
    }

    initAmbient() {
        const ambient = this.graph.yas.ambient;

        this.setGlobalAmbientLight(ambient.data.ambient.r,
            ambient.data.ambient.g, ambient.data.ambient.b,
            ambient.data.ambient.a);

        this.gl.clearColor(ambient.data.background.r,
            ambient.data.background.g, ambient.data.background.b,
            ambient.data.background.a);
    }

    initLights() {
        const lights = this.graph.yas.lights;

        let i = 0;

        // Reads the lights from the scene graph.
        for (let id in lights.elements) {
            let light = lights.elements[id];
            if (i >= 8) break;

            if (light.type === "omni") {
                light.index = i;

                let location = light.data.location;
                let ambient = light.data.ambient;
                let diffuse = light.data.diffuse;
                let specular = light.data.specular;

                this.lights[i].setPosition(location.x, location.y, location.z, location.w);
                this.lights[i].setAmbient(ambient.r, ambient.g, ambient.b, ambient.a);
                this.lights[i].setDiffuse(diffuse.r, diffuse.g, diffuse.b, diffuse.a);
                this.lights[i].setSpecular(specular.r, specular.g, specular.b, specular.a);
                this.lights[i].setVisible(LIGHTS_VISIBLE);

                this.lights[i].setConstantAttenuation(LIGHT_CONSTANT_ATTENUATION);
                this.lights[i].setLinearAttenuation(LIGHT_LINEAR_ATTENUATION);
                this.lights[i].setQuadraticAttenuation(LIGHT_QUADRATIC_ATTENUATION);

                console.log(light.data.enabled);
                if (light.data.enabled) {
                    console.log("ENABLE");
                    this.lights[i].enable();
                } else {
                    console.log("DISABLE");
                    this.lights[i].disable();
                }

                this.lights[i].update();

                ++i;
            } else {
                console.warn("light > spot not yet supported in MyScene");
            }
        }
    }

    initTextures() {
        const textures = this.graph.yas.textures;

        this.textures = {};

        for (let id in textures.elements) {
            let texture = textures.elements[id];

            this.textures[id] = new CGFtexture(this, texture.data.file);
        }
    }

    initMaterials() {
        const materials = this.graph.yas.materials;

        this.materials = {};

        for (let id in materials.elements) {
            let material = materials.elements[id];

            let shininess = material.data.shininess;
            let emission = material.data.emission;
            let ambient = material.data.ambient;
            let diffuse = material.data.diffuse;
            let specular = material.data.specular;

            this.materials[id] = new CGFappearance(this);

            this.materials[id].setShininess(shininess);
            this.materials[id].setEmission(emission.r, emission.g, emission.g, emission.a);
            this.materials[id].setAmbient(ambient.r, ambient.g, ambient.b, ambient.a);
            this.materials[id].setDiffuse(diffuse.r, diffuse.g, diffuse.b, diffuse.a);
            this.materials[id].setSpecular(specular.r, specular.g, specular.b, specular.a);
        }
    }

    initPrimitives() {
        const primitives = this.graph.yas.primitives;

        this.primitives = {};

        for (let id in primitives.elements) {
            let prim = primitives.elements[id];

            this.primitives[id] = buildPrimitive(this, prim);
        }
    }

    setCamera(id) {
        let view = this.graph.yas.views.get(id);
        let data = view.data;

        // Position
        this.camera.setPosition(vec3.fromValues(data.from.x, data.from.y, data.from.z));

        // Target
        this.camera.setTarget(vec3.fromValues(data.to.x, data.to.y, data.to.z));

        this.camera.near = data.near;
        this.camera.far = data.far;
        //this.camera.fov = degToRad(data.angle);
    }

    applyTransformation(transformation) {
        let operations = transformation.elements;

        for (let operation of operations) {
            let data = operation.data;

            switch (operation.type) {
            case 'translate':
                this.translate(data.x, data.y, data.z);
                break;
            case 'rotate':
                let x = data.axis === 'x';
                let y = data.axis === 'y';
                let z = data.axis === 'z';
                this.rotate(degToRad(data.angle), x, y, z);
                break;
            case 'scale':
                this.scale(data.x, data.y, data.z);
                break;
            }
        }
    }

    clearMatrixStack() {
        if (this.matrixStack.length > 0) {
            console.warn("Matrix stack was not empty at the end of display()");
            this.matrixStack.length = 0;
        }
    }

    presetup() {
        if (this.newCamera) {
            this.newCamera = false;

            this.setCamera(this.selectedCamera);
        }
    }

    updateLights()  {
        for (var i = 0; i < this.lights.length; i++)
            this.lights[i].update();
    }

    display() {
        this.presetup();

        // ---- BEGIN Background, camera and axis setup

        // Clear image and depth buffer everytime we update the scene
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Initialize Model-View matrix as identity (no transformation)
        this.updateProjectionMatrix();
        this.clearMatrixStack();
        this.loadIdentity();

        // Apply transformations corresponding to the camera position relative to the origin
        this.applyViewMatrix();
        this.updateLights();

        // ---- END Background, camera and axis setup

        // ---- BEGIN Primary display

        this.pushMatrix();

        this.axis.display();

        if (this.graphLoaded) {
            this.traverseGraph();
        }



        this.expert.display();

        this.popMatrix();

        // ---- END Primary display
    }

    traverseGraph() {
        this.traverser(this.graph.yas.root, null, null);
    }

    traverser(current, sceneMaterial, sceneTexture) {
        const transformation = current.transformation;
        const material = current.materials.elements[0];
        const texture = current.texture;
        const children = current.children;

        // Transformation & Material & Texture Stack PUSH
        this.pushMatrix();

        // Transformation
        if (transformation.mode === "reference") {
            this.applyTransformation(transformation.ref);
        } else if (transformation.mode === "immediate") {
            this.applyTransformation(transformation.transf);
        }

        // Material
        if (material.mode === "reference") {
            sceneMaterial = this.materials[material.id];
        }

        // Texture
        if (texture.mode === "none") {
            sceneTexture = false; // allowed for setTexture()
        } else if (texture.mode === "reference") {
            sceneTexture = this.textures[texture.id];
        }

        // Apply Material
        sceneMaterial.setTexture(sceneTexture);
        sceneMaterial.apply();

        // Recurse & Display primitives
        for (let id in children.elements) {
            let child = children.elements[id];
            if (child.type === "componentref") {
                this.traverser(child.ref, sceneMaterial, sceneTexture);
            } else {
                this.primitives[child.id].display();
            }
        }

        // Transformation & Material & Texture Stack POP
        this.popMatrix();
    }
}
