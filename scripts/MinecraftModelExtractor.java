import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.builders.CubeDeformation;

/**
 * Runs inside the Minecraft 26.2 classpath and serializes the baked vanilla
 * model tree. This is an offline build helper; it is never shipped to the
 * browser or loaded by the game server.
 */
public final class MinecraftModelExtractor {
    private static final Field CUBES;
    private static final Field CHILDREN;

    static {
        try {
            CUBES = ModelPart.class.getDeclaredField("cubes");
            CHILDREN = ModelPart.class.getDeclaredField("children");
            CUBES.setAccessible(true);
            CHILDREN.setAccessible(true);
        } catch (ReflectiveOperationException error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    private static Method layerFactory(Class<?> modelClass) {
        for (Class<?> current = modelClass; current != null; current = current.getSuperclass()) {
            for (Method method : current.getDeclaredMethods()) {
                if (!(method.getName().equals("createBodyLayer") || method.getName().equals("createBodyMesh") ||
                      method.getName().equals("createBodyModel") || method.getName().equals("createSpiderBodyLayer") ||
                      method.getName().equals("createOuterBodyLayer") || method.getName().equals("createMesh")) ||
                    !Modifier.isStatic(method.getModifiers())) continue;
                if (method.getParameterCount() == 0 ||
                    (method.getParameterCount() == 1 && method.getParameterTypes()[0] == CubeDeformation.class) ||
                    (method.getParameterCount() == 2 && method.getParameterTypes()[0] == CubeDeformation.class &&
                     method.getParameterTypes()[1] == float.class)) {
                    method.setAccessible(true);
                    return method;
                }
            }
        }
        return null;
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String number(float value) {
        if (value == 0f) return "0";
        if (Float.isNaN(value) || Float.isInfinite(value)) return "0";
        return Float.toString(value);
    }

    private static void comma(StringBuilder out, boolean[] first) {
        if (!first[0]) out.append(',');
        first[0] = false;
    }

    private static void appendVertex(StringBuilder out, Object vertex) throws ReflectiveOperationException {
        Method x = vertex.getClass().getMethod("x");
        Method y = vertex.getClass().getMethod("y");
        Method z = vertex.getClass().getMethod("z");
        Method u = vertex.getClass().getMethod("u");
        Method v = vertex.getClass().getMethod("v");
        out.append('{')
            .append("\"position\":[").append(number((float) x.invoke(vertex))).append(',')
            .append(number((float) y.invoke(vertex))).append(',').append(number((float) z.invoke(vertex))).append("]")
            .append(",\"uv\":[").append(number((float) u.invoke(vertex))).append(',')
            .append(number((float) v.invoke(vertex))).append("]}");
    }

    private static void appendCube(StringBuilder out, Object cube) throws ReflectiveOperationException {
        Field minX = cube.getClass().getField("minX");
        Field minY = cube.getClass().getField("minY");
        Field minZ = cube.getClass().getField("minZ");
        Field maxX = cube.getClass().getField("maxX");
        Field maxY = cube.getClass().getField("maxY");
        Field maxZ = cube.getClass().getField("maxZ");
        Field polygons = cube.getClass().getField("polygons");
        out.append('{')
            .append("\"min\":[").append(number(minX.getFloat(cube))).append(',')
            .append(number(minY.getFloat(cube))).append(',').append(number(minZ.getFloat(cube))).append(']')
            .append(",\"max\":[").append(number(maxX.getFloat(cube))).append(',')
            .append(number(maxY.getFloat(cube))).append(',').append(number(maxZ.getFloat(cube))).append(']')
            .append(",\"faces\":[");

        Object[] faceArray = (Object[]) polygons.get(cube);
        boolean[] firstFace = {true};
        for (Object face : faceArray) {
            comma(out, firstFace);
            Method normal = face.getClass().getMethod("normal");
            Object normalValue = normal.invoke(face);
            Method nx = normalValue.getClass().getMethod("x");
            Method ny = normalValue.getClass().getMethod("y");
            Method nz = normalValue.getClass().getMethod("z");
            Method vertices = face.getClass().getMethod("vertices");
            Object[] vertexArray = (Object[]) vertices.invoke(face);
            out.append('{').append("\"normal\":[")
                .append(number(((Number) nx.invoke(normalValue)).floatValue())).append(',')
                .append(number(((Number) ny.invoke(normalValue)).floatValue())).append(',')
                .append(number(((Number) nz.invoke(normalValue)).floatValue())).append("],\"vertices\":[");
            boolean[] firstVertex = {true};
            for (Object vertex : vertexArray) {
                comma(out, firstVertex);
                appendVertex(out, vertex);
            }
            out.append("]}");
        }
        out.append("]}");
    }

    @SuppressWarnings("unchecked")
    private static void appendPart(StringBuilder out, String name, ModelPart part) throws ReflectiveOperationException {
        out.append('{').append("\"name\":").append(quote(name))
            .append(",\"pivot\":[").append(number(part.x)).append(',').append(number(part.y)).append(',').append(number(part.z)).append(']')
            .append(",\"rotation\":[").append(number(part.xRot)).append(',').append(number(part.yRot)).append(',').append(number(part.zRot)).append(']')
            .append(",\"cubes\":[");
        List<Object> cubes = (List<Object>) CUBES.get(part);
        boolean[] firstCube = {true};
        for (Object cube : cubes) {
            comma(out, firstCube);
            appendCube(out, cube);
        }
        out.append("],\"children\":[");

        Map<String, ModelPart> children = (Map<String, ModelPart>) CHILDREN.get(part);
        List<Map.Entry<String, ModelPart>> sorted = new ArrayList<>(children.entrySet());
        sorted.sort(Comparator.comparing(Map.Entry::getKey));
        boolean[] firstChild = {true};
        for (Map.Entry<String, ModelPart> child : sorted) {
            comma(out, firstChild);
            appendPart(out, child.getKey(), child.getValue());
        }
        out.append("]}");
    }

    private static String extract(String className, int textureWidth, int textureHeight) throws Exception {
        Class<?> modelClass = Class.forName(className);
        Method factory = layerFactory(modelClass);
        if (factory == null) throw new IllegalStateException("factory de modelo nao encontrado");
        Object layer;
        if (factory.getParameterCount() == 0) layer = factory.invoke(null);
        else if (factory.getParameterCount() == 1) layer = factory.invoke(null, CubeDeformation.NONE);
        else layer = factory.invoke(null, CubeDeformation.NONE, 0f);
        ModelPart root;
        if (layer.getClass().getName().equals("net.minecraft.client.model.geom.builders.LayerDefinition")) {
            Method bakeRoot = layer.getClass().getMethod("bakeRoot");
            root = (ModelPart) bakeRoot.invoke(layer);
        } else {
            Method getRoot = layer.getClass().getMethod("getRoot");
            Object rootDefinition = getRoot.invoke(layer);
            Method bake = rootDefinition.getClass().getMethod("bake", int.class, int.class);
            root = (ModelPart) bake.invoke(rootDefinition, textureWidth, textureHeight);
        }
        StringBuilder out = new StringBuilder();
        out.append('{').append("\"sourceClass\":").append(quote(className))
            .append(",\"coordinateSystem\":\"minecraft-model-part\",\"root\":");
        appendPart(out, "root", root);
        out.append('}');
        return out.toString();
    }

    public static void main(String[] args) {
        for (String argument : args) {
            String[] pieces = argument.split("\\|", -1);
            String className = pieces[0];
            int textureWidth = pieces.length > 1 ? Integer.parseInt(pieces[1]) : 64;
            int textureHeight = pieces.length > 2 ? Integer.parseInt(pieces[2]) : 32;
            try {
                System.out.println("OK\t" + className + "\t" + extract(className, textureWidth, textureHeight));
            } catch (Throwable error) {
                Throwable cause = error;
                while (cause.getCause() != null) cause = cause.getCause();
                System.out.println("ERR\t" + className + "\t" + cause.getClass().getName() + ": " + cause.getMessage());
            }
        }
    }
}
