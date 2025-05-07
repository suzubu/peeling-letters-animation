// === [ Imports ] ===
import * as THREE from "three"; // Main Three.js library
import "./style.css"; // External styles for layout/canvas

// === [ Texture Files ] ===
const texture = "/Dark2.png"; // Main PNG (shown with shader distortion)
const shadow_texture = "/Blurred2.png"; // Secondary PNG (adds soft blur/overlay)

// === [ Scene Setup ] ===
const scene = new THREE.Scene();

// === [ Camera Setup ] ===
let aspect = window.innerWidth / window.innerHeight;
let camera_distance = 8;
const camera = new THREE.OrthographicCamera(
  -camera_distance * aspect,
  camera_distance * aspect,
  camera_distance,
  -camera_distance,
  0.01,
  1000
);
camera.position.set(0, -10, 5);
camera.lookAt(0, 0, 0);

// === [ Renderer Setup ] ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
scene.background = new THREE.Color(0xffffff);

// === [ Sphere Marker ] ===
const geometry_sphere = new THREE.SphereGeometry(0.25, 32, 16);
const material_sphere = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const sphere = new THREE.Mesh(geometry_sphere, material_sphere);
scene.add(sphere);

// === [ Hit Plane for Raycasting ] ===
const geometry_hit = new THREE.PlaneGeometry(500, 500, 10, 10);
const material_hit = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const hit = new THREE.Mesh(geometry_hit, material_hit);
hit.name = "hit";
scene.add(hit);

// === [ Shared Geometry ] ===
const geometry = new THREE.PlaneGeometry(15, 15, 100, 100);

// === [ Main Image Plane ] ===
const shader_material = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: new THREE.TextureLoader().load(texture) },
    uDisplacement: { value: new THREE.Vector3(0, 0, 0) },
  },
  vertexShader: `
    varying vec2 vUv;
    uniform vec3 uDisplacement;

    float easeInOutCubic(float x) {
      return x < 0.5 ? 4. * x * x * x : 1. - pow(-2. * x + 2., 3.) / 2.;
    }

    float map(float value, float min1, float max1, float min2, float max2) {
      return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
    }

    void main() {
      vUv = uv;
      vec3 new_position = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      float dist = length(uDisplacement - worldPosition.rgb);
      float min_distance = 3.0;

      if (dist < min_distance) {
        float mapped = map(dist, 0.0, min_distance, 1.0, 0.0);
        float val = easeInOutCubic(mapped);
        new_position.z += val;
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(new_position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uTexture;

    void main() {
      vec4 color = texture2D(uTexture, vUv);
      gl_FragColor = color;
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const plane = new THREE.Mesh(geometry, shader_material);
plane.rotation.z = Math.PI / 4;

// === [ Shadow Plane ] ===
const shader_material_shadow = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: new THREE.TextureLoader().load(shadow_texture) },
    uDisplacement: { value: new THREE.Vector3(0, 0, 0) },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float dist;
    uniform vec3 uDisplacement;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      dist = length(uDisplacement - worldPosition.rgb);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float dist;
    uniform sampler2D uTexture;

    float map(float value, float min1, float max1, float min2, float max2) {
      return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
    }

    void main() {
      vec4 color = texture2D(uTexture, vUv);
      float min_distance = 3.0;
      if (dist < min_distance) {
        float alpha = map(dist, min_distance, 0.0, color.a, 0.0);
        color.a = alpha;
      }
      gl_FragColor = color;
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const plane_shadow = new THREE.Mesh(geometry, shader_material_shadow);
plane_shadow.rotation.z = Math.PI / 4;

// === [ Fix render order: make Dark2 on top ] ===
plane.renderOrder = 2;
plane_shadow.renderOrder = 1;

// === [ Add to scene ] ===
scene.add(plane);
scene.add(plane_shadow);

// === [ Pointer Interaction ] ===
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(hit);

  if (intersects.length > 0) {
    const point = intersects[0].point;
    sphere.position.copy(point);
    shader_material.uniforms.uDisplacement.value = point;
    shader_material_shadow.uniforms.uDisplacement.value = point;
  }
}

window.addEventListener("pointermove", onPointerMove);

// === [ Render Loop ] ===
function render() {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}
render();

// === [ Resize Handler ] ===
function onWindowResize() {
  aspect = window.innerWidth / window.innerHeight;
  camera.left = -camera_distance * aspect;
  camera.right = camera_distance * aspect;
  camera.top = camera_distance;
  camera.bottom = -camera_distance;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
