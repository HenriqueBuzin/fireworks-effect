/*

Author: Henrique Buzin

Adapted from https://codepen.io/franciscoknebel/pen/pgmYMo

*/

(function ($) {
    var MAX_PARTICLES = 500;

    var FUNCTIONS = {
        'init': function (element, options) {
            var jqe = $(element);

            // Check this element isn't already inited
            if (jqe.data('fireworks_data') !== undefined) {
                console.log('Looks like this element is already inited!');
                return;
            }

            var container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.minWidth = '100%';
            container.style.minHeight = '100%';
            container.style.pointerEvents = 'none';
            container.style.backgroundColor = 'rgba(0, 0, 0, ' + (options && options.opacity ? options.opacity : 0) + ')';
            container.style.zIndex = '-1';

            element.appendChild(container);

            var canvas = document.createElement('canvas'),
                canvas_buffer = document.createElement('canvas');

            container.appendChild(canvas);
            canvas.style.pointerEvents = 'none';

            data = {
                'element': element,
                'canvas': canvas,
                'context': canvas.getContext('2d'),
                'canvas_buffer': canvas_buffer,
                'context_buffer': canvas_buffer.getContext('2d'),
                'particles': [],
                'rockets': [],
                'MAX_ROCKETS': 5
            };

            jqe.data('fireworks_data', data);

            updateCanvasSize();

            // Kickoff the loops
            data.interval = setInterval(loop.bind(this, data), 1000 / 50);

            updateMaxRockets();

            $(window).resize(function() {
                updateCanvasSize();
                updateMaxRockets();
            });

            function updateCanvasSize() {
                if (data.canvas) {
                    data.canvas.width = data.canvas_buffer.width = container.offsetWidth;
                    data.canvas.height = data.canvas_buffer.height = container.offsetHeight;
                }
            }

            function updateMaxRockets() {
                var area = window.innerWidth * window.innerHeight;
                var maxRocketsBasedOnArea = Math.round(area / 50000); // Ajuste este valor conforme necessário
                data.MAX_ROCKETS = Math.max(5, Math.min(maxRocketsBasedOnArea, 20)); // Limita entre 5 e 20
            }

        },
        'destroy': function (element) {
            var jqe = $(element);

            // Check this element isn't already inited
            if (jqe.data('fireworks_data') === undefined) {
                console.log('Looks like this element is not yet inited!');
                return;
            }
            var data = jqe.data('fireworks_data');
            jqe.removeData('fireworks_data');

            // Stop the interval
            clearInterval(data.interval);

            // Remove the canvas
            data.canvas.remove();

            // Reset the elements positioning
            data.element.style.position = '';
        }
    };

    $.fn.fireworks = function (action, options) {
        // Assume no action means we want to init
        if (typeof action === 'object' || !action) {
            options = action;
            action = 'init';
        }

        // Process each element
        this.each(function () {
            FUNCTIONS[action](this, options);
        });

        // Chaining ftw :)
        return this;
    };

    function launch(data) {
        // Usar data.MAX_ROCKETS em vez de MAX_ROCKETS diretamente
        if (data.rockets.length < data.MAX_ROCKETS) {
            var rocket = new Rocket(data);
            data.rockets.push(rocket);
        }
    }

    function loop(data) {
        // Launch a new rocket
        launch(data);

        // Fade the background out slowly
        data.context_buffer.clearRect(0, 0, data.canvas.width, data.canvas.height);
        data.context_buffer.globalAlpha = 0.9;
        
        data.context_buffer.drawImage(data.canvas, 0, 0);
        data.context.clearRect(0, 0, data.canvas.width, data.canvas.height);
        data.context.drawImage(data.canvas_buffer, 0, 0);

        // Update the rockets
        var existingRockets = [];
        data.rockets.forEach(function (rocket) {
            // update and render
            rocket.update();
            rocket.render(data.context);

            // random chance of 1% if rockets is above the middle
            var randomChance = rocket.pos.y < (data.canvas.height * 2 / 3) ? (Math.random() * 100 <= 1) : false;

            /* Explosion rules
                 - 80% of screen
                - going down
                - close to the mouse
                - 1% chance of random explosion
            */
            if (rocket.pos.y < data.canvas.height / 5 || rocket.vel.y >= 0 || randomChance) {
                rocket.explode(data);
            } else {
                existingRockets.push(rocket);
            }
        });
        data.rockets = existingRockets;

        // Update the particles
        var existingParticles = [];
        data.particles.forEach(function (particle) {
            particle.update();

            // render and save particles that can be rendered
            if (particle.exists()) {
                particle.render(data.context);
                existingParticles.push(particle);
            }
        });
        data.particles = existingParticles;

        while (data.particles.length > MAX_PARTICLES) {
            data.particles.shift();
        }
    }

    function Particle(pos) {
        this.pos = {
            x: pos ? pos.x : 0,
            y: pos ? pos.y : 0
        };
        this.vel = {
            x: 0,
            y: 0
        };
        this.shrink = .97;
        this.size = 2;

        this.resistance = 1;
        this.gravity = 0;

        this.flick = false;

        this.alpha = 1;
        this.fade = 0;
        this.color = 0;
    }

    Particle.prototype.update = function () {
        // apply resistance
        this.vel.x *= this.resistance;
        this.vel.y *= this.resistance;

        // gravity down
        this.vel.y += this.gravity;

        // update position based on speed
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        // shrink
        this.size *= this.shrink;

        // fade out
        this.alpha -= this.fade;
    };

    Particle.prototype.render = function (c) {
        if (!this.exists()) {
            return;
        }

        c.save();

        c.globalCompositeOperation = 'lighter';

        var x = this.pos.x,
            y = this.pos.y,
            r = this.size / 2;

        var gradient = c.createRadialGradient(x, y, 0.1, x, y, r);
        gradient.addColorStop(0.1, "rgba(255,255,255," + this.alpha + ")");
        gradient.addColorStop(0.8, "hsla(" + this.color + ", 100%, 50%, " + this.alpha + ")");
        gradient.addColorStop(1, "hsla(" + this.color + ", 100%, 50%, 0.1)");

        c.fillStyle = gradient;

        c.beginPath();
        c.arc(this.pos.x, this.pos.y, this.flick ? Math.random() * this.size : this.size, 0, Math.PI * 2, true);
        c.closePath();
        c.fill();

        c.restore();
    };

    Particle.prototype.exists = function () {
        return this.alpha >= 0.1 && this.size >= 1;
    };

    function Rocket(data) {
        Particle.apply(
            this,
            [{
                x: Math.random() * data.canvas.width * 2 / 3 + data.canvas.width / 6,
                y: data.canvas.height
            }]
        );

        this.explosionColor = Math.floor(Math.random() * 360 / 10) * 10;
        this.vel.y = Math.random() * -3 - 4;
        this.vel.x = Math.random() * 6 - 3;
        this.size = 2;
        this.shrink = 0.999;
        this.gravity = 0.01;
    }

    Rocket.prototype = new Particle();
    Rocket.prototype.constructor = Rocket;

    Rocket.prototype.explode = function (data) {
        var count = Math.random() * 10 + 80;

        for (var i = 0; i < count; i++) {
            var particle = new Particle(this.pos);
            var angle = Math.random() * Math.PI * 2;

            // emulate 3D effect by using cosine and put more particles in the middle
            var speed = Math.cos(Math.random() * Math.PI / 2) * 15;

            particle.vel.x = Math.cos(angle) * speed;
            particle.vel.y = Math.sin(angle) * speed;

            particle.size = 10;

            particle.gravity = 0.2;
            particle.resistance = 0.92;
            particle.shrink = Math.random() * 0.05 + 0.93;

            particle.flick = true;
            particle.color = this.explosionColor;

            data.particles.push(particle);
        }
    };

    Rocket.prototype.render = function (c) {
        if (!this.exists()) {
            return;
        }

        c.save();

        c.globalCompositeOperation = 'lighter';

        var x = this.pos.x,
            y = this.pos.y,
            r = this.size / 2;

        var gradient = c.createRadialGradient(x, y, 0.1, x, y, r);
        gradient.addColorStop(0.1, "rgba(255, 255, 255 ," + this.alpha + ")");
        gradient.addColorStop(0.2, "hsla(" + this.explosionColor + ", 100%, 50%, " + this.alpha + ")");


        c.fillStyle = gradient;

        c.beginPath();
        c.arc(this.pos.x, this.pos.y, this.flick ? Math.random() * this.size / 2 + this.size / 2 : this.size, 0, Math.PI * 2, true);
        c.closePath();
        c.fill();

        c.restore();
    };
}(jQuery));
