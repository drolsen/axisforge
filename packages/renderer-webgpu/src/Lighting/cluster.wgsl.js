export default /* wgsl */ `
struct Cluster {
  offset : u32,
  count : u32,
};

@group(0) @binding(0) var<storage, read> clusters : array<Cluster>;
@group(0) @binding(1) var<storage, read> clusterLightIndices : array<u32>;

fn clusterLightCount(index : u32) -> u32 {
  return clusters[index].count;
}

fn clusterLightOffset(index : u32) -> u32 {
  return clusters[index].offset;
}

fn fetchClusterLight(clusterIndex : u32, i : u32) -> u32 {
  let c = clusters[clusterIndex];
  return clusterLightIndices[c.offset + i];
}
`;
