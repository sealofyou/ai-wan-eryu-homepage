import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DESK_LAYOUT } from "../layout";

const roundedShape = (width: number, height: number, radius: number) => {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
};

const grilleTexture = () => {
  const width = 512, height = 64;
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + (Math.floor(y / 5) % 2) * 2.5) % 5 - 2.5;
    const py = y % 5 - 2.5;
    const hole = px * px + py * py < 2;
    const value = hole ? 14 : 66 + ((x * 17 + y * 31) % 5);
    const offset = (y * width + x) * 4;
    bytes.set([value, value + 2, value + 3, 255], offset);
  }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

export const createSoundbarStudyVisual = ({ withBrand = false }: {withBrand?: boolean} = {}) => {
  const group = new THREE.Group();
  group.name = "soundbar-study-visual";
  const layout = DESK_LAYOUT.mainMonitor.soundbar;
  const deskTop = DESK_LAYOUT.desk.surface.position.y + DESK_LAYOUT.desk.surface.size.height / 2;
  group.position.set(layout.position.x, deskTop + layout.size.height / 2, layout.position.z);
  const owned = new Set<{dispose:()=>void}>();
  const own = <T extends {dispose:()=>void}>(resource: T): T => { owned.add(resource); return resource; };
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(own(geometry), own(material));
    mesh.name = name;
    mesh.position.set(0, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  try {
    const shell = own(new THREE.MeshStandardMaterial({color:"#25282a",roughness:0.56,metalness:0.12}));
    const inner = own(new THREE.MeshStandardMaterial({color:"#101315",roughness:0.9}));
    add("soundbar-shell", new RoundedBoxGeometry(4.2, 0.54, 0.75, 2, 0.075), shell, 0.02);
    const outline = roundedShape(4.184, 0.524, 0.07);
    outline.holes.push(roundedShape(4.04, 0.39, 0.045));
    add("soundbar-front-rim", new THREE.ExtrudeGeometry(outline, {depth:0.035,bevelEnabled:true,bevelSize:0.008,bevelThickness:0.008,bevelSegments:2,curveSegments:5,steps:1}), shell, 0.02, 0.35);
    add("soundbar-grille-backing", new THREE.ShapeGeometry(roundedShape(4.06, 0.41, 0.05), 5), inner, 0.02, 0.377);
    const map = own(grilleTexture());
    const grille = add("soundbar-grille", new THREE.ShapeGeometry(roundedShape(4.04,0.39,0.045),5), new THREE.MeshStandardMaterial({map,roughness:0.72,metalness:0.15}), 0.02, 0.381);
    const grillePositions = grille.geometry.getAttribute("position");
    const grilleUv = grille.geometry.getAttribute("uv");
    for (let i = 0; i < grillePositions.count; i++) {
      grilleUv.setXY(i, grillePositions.getX(i) / 4.04 + 0.5, grillePositions.getY(i) / 0.39 + 0.5);
    }
    grilleUv.needsUpdate = true;
    grille.castShadow = false;
    const feet = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(0.11,0.11,0.04,12)),inner,4);
    feet.name = "soundbar-feet";
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (const x of [-1.6,1.6]) for (const z of [-0.22,0.22]) feet.setMatrixAt(index++,matrix.makeTranslation(x,-0.27,z));
    feet.castShadow = true;
    group.add(feet);
    if (withBrand) {
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 96;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Soundbar brand canvas unavailable");
      context.font = '500 64px "Segoe UI", sans-serif';
      context.textAlign = "center"; context.textBaseline = "middle";
      context.fillStyle = "#bab5a9";
      context.fillText("Eryu",128,48);
      const brandMap = own(new THREE.CanvasTexture(canvas));
      brandMap.colorSpace = THREE.SRGBColorSpace;
      add("soundbar-brand-plate", new RoundedBoxGeometry(0.55,0.195,0.012,2,0.023),inner,0.02,0.383);
      const brand = add("soundbar-brand",new THREE.PlaneGeometry(0.48,0.18),new THREE.MeshBasicMaterial({map:brandMap,transparent:true,depthWrite:false,toneMapped:false}),0.02,0.392);
      brand.castShadow = false;
      brand.receiveShadow = false;
    }
    group.userData.textureBytes = 512 * 64 * 4 + (withBrand ? 256 * 96 * 4 : 0);
    group.updateMatrixWorld(true);
    return group;
  } catch (error) {
    owned.forEach(resource => resource.dispose());
    throw error;
  }
};
