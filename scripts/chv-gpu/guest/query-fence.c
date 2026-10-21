/* A GL query, then glFinish and its result: what hung every agent's
 * desktop while crosvm's vhost-user GPU never called virgl_renderer_poll(). */
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES3/gl3.h>
#include <stdio.h>
int main(void)
{
	PFNEGLGETPLATFORMDISPLAYEXTPROC get_display = (PFNEGLGETPLATFORMDISPLAYEXTPROC)eglGetProcAddress("eglGetPlatformDisplayEXT");
	EGLDisplay d = get_display(EGL_PLATFORM_SURFACELESS_MESA, EGL_DEFAULT_DISPLAY, NULL);
	EGLint ctx_attrs[] = {EGL_CONTEXT_MAJOR_VERSION, 3, EGL_NONE};
	if (!eglInitialize(d, NULL, NULL) || !eglBindAPI(EGL_OPENGL_ES_API))
		return 2;
	EGLContext c = eglCreateContext(d, EGL_NO_CONFIG_KHR, EGL_NO_CONTEXT, ctx_attrs);
	if (c == EGL_NO_CONTEXT || !eglMakeCurrent(d, EGL_NO_SURFACE, EGL_NO_SURFACE, c))
		return 2;
	printf("renderer: %s\n", glGetString(GL_RENDERER));
	GLuint fb, rb, q, passed = 0;
	glGenRenderbuffers(1, &rb);
	glBindRenderbuffer(GL_RENDERBUFFER, rb);
	glRenderbufferStorage(GL_RENDERBUFFER, GL_RGBA8, 64, 64);
	glGenFramebuffers(1, &fb);
	glBindFramebuffer(GL_FRAMEBUFFER, fb);
	glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, rb);
	glGenQueries(1, &q);
	glBeginQuery(GL_ANY_SAMPLES_PASSED, q);
	glClearColor(1, 0, 0, 1);
	glClear(GL_COLOR_BUFFER_BIT);
	glEndQuery(GL_ANY_SAMPLES_PASSED);
	fflush(stdout);
	glGetQueryObjectuiv(q, GL_QUERY_RESULT, &passed);
	glClear(GL_COLOR_BUFFER_BIT);
	glFinish();
	printf("query and glFinish returned (result %u)\n", passed);
	return 0;
}
